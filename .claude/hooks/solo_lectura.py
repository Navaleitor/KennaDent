"""Hook PreToolUse de los agentes de revisión: solo deja pasar comandos de consulta.

Lo usan los agentes de .claude/agents/ en su frontmatter:

    hooks:
      PreToolUse:
        - matcher: "Bash|PowerShell"
          hooks:
            - type: command
              command: 'python "${CLAUDE_PROJECT_DIR}/.claude/hooks/solo_lectura.py" consulta'
              onFailure: block

Perfiles:
  consulta  git de solo consulta y filtros de texto (grep, head, tail...).
  base      consulta + psql de SOLO LECTURA contra la base de QA (seguridad-datos).
  qa        consulta + docker compose para correr pruebas (qa-backend).
  pantallas consulta + las pruebas del frontend en Docker (qa-pantallas): revisar y Vitest
            dentro del servicio "frontend", Playwright con "run --rm pruebas-pantallas" y logs.

Un comando permitido sale con 0. Uno prohibido sale con 2 y el motivo va a stderr
(Claude Code bloquea la herramienta y el agente ve el motivo).
Pruebas del propio hook: python .claude/hooks/solo_lectura.py --probar
"""
import json
import re
import shlex
import sys

GIT_CONSULTA = {"status", "diff", "log", "show", "branch", "merge-base", "rev-parse", "ls-files", "blame"}
# git branch solo para listar; estas opciones no crean, borran ni renombran ramas
BRANCH_OPCIONES = {"-a", "-r", "--all", "--remotes", "--show-current", "-v", "-vv", "--verbose",
                   "--no-color", "--color=never", "--list", "-l"}
BRANCH_CON_VALOR = {"--contains", "--no-contains", "--merged", "--no-merged", "--points-at", "--format", "--sort"}
FILTROS = {"grep", "head", "tail", "wc", "sort", "uniq", "cut", "echo", "true", "ls"}

PSQL_LECTURA = ["docker", "compose", "exec", "-T", "-e", "PGOPTIONS=-cdefault_transaction_read_only=on", "db", "psql"]
PSQL_OPCIONES_PROHIBIDAS = {"-f", "--file", "-o", "--output", "-L", "--log-file"}
SQL_PROHIBIDO = re.compile(
    r"\b(insert|update|delete|merge|drop|create|alter|truncate|grant|revoke|copy|comment|vacuum|analyze|"
    r"reindex|cluster|lock|call|do|set|reset|begin|start|commit|rollback|savepoint|prepare|execute|"
    r"listen|notify|refresh|import|load|discard|security)\b"
    r"|set_config|pg_read|pg_write|lo_import|lo_export|dblink|pg_terminate|pg_cancel|pg_reload|pg_sleep",
    re.IGNORECASE)

COMPOSE_SUBCOMANDOS = {"ps", "exec", "logs", "up", "down", "top", "images", "version"}
DENTRO_PROHIBIDO = {"env", "printenv", "cat", "less", "more"}


# qa-pantallas: solo estos comandos dentro del contenedor "frontend"
FRONTEND_PERMITIDOS = [["npm", "run", "revisar"], ["npm", "test"], ["npx", "vitest", "run"]]
# Opciones de Playwright que solo eligen qué correr y cómo mostrarlo (ninguna escribe fuera de test-results)
PLAYWRIGHT_CON_VALOR = {"-g", "--grep", "--project", "--reporter", "--retries"}
PLAYWRIGHT_SOLAS = {"-x", "--list"}


class Bloqueado(Exception):
    pass


def tokens_de(comando):
    lex = shlex.shlex(comando, posix=True, punctuation_chars="();<>|&\n")
    lex.whitespace = " \t\r"
    lex.whitespace_split = True
    return list(lex)


def es_env(token):
    t = token.replace("\\", "/")
    return t == ".env" or t.endswith("/.env")


def revisar_git(args):
    if args[:1] == ["-C"]:
        args = args[2:]
    if not args or args[0] not in GIT_CONSULTA:
        raise Bloqueado(f"git {args[0] if args else ''}: solo se permiten {', '.join(sorted(GIT_CONSULTA))}")
    if any(a.startswith("--output") for a in args):
        raise Bloqueado("git con --output escribe un archivo")
    if args[0] == "branch":
        esperar_valor = False
        for a in args[1:]:
            if esperar_valor:
                esperar_valor = False
            elif a in BRANCH_CON_VALOR:
                esperar_valor = True
            elif any(a.startswith(o + "=") for o in BRANCH_CON_VALOR):
                pass
            elif a in BRANCH_OPCIONES:
                pass
            else:
                raise Bloqueado(f"git branch {a}: solo se permite listar ramas")


def revisar_psql(resto):
    for t in resto:
        if t in PSQL_OPCIONES_PROHIBIDAS or any(t.startswith(o + "=") for o in PSQL_OPCIONES_PROHIBIDAS if o.startswith("--")):
            raise Bloqueado(f"psql {t}: no se permite leer ni escribir archivos")
    texto = " ".join(resto)
    if "\\" in texto:
        raise Bloqueado("psql: no se permiten comandos con diagonal invertida (\\)")
    m = SQL_PROHIBIDO.search(texto)
    if m:
        raise Bloqueado(f"psql: '{m.group(0)}' no es una consulta de solo lectura")


def revisar_compose(args):
    i = 0
    while i < len(args) and args[i].startswith("-"):
        i += 1
    if i >= len(args) or args[i] not in COMPOSE_SUBCOMANDOS:
        sub = args[i] if i < len(args) else ""
        raise Bloqueado(f"docker compose {sub}: no permitido (puede mostrar secretos o cambiar el entorno)")
    if args[i] == "exec":
        restantes = args[i + 1:]
        if any(t in DENTRO_PROHIBIDO for t in restantes):
            raise Bloqueado("docker compose exec: no se permite leer variables de entorno ni archivos del contenedor")


def revisar_pantallas(args):
    """args = lo que va después de "docker compose"."""
    if args[:1] in (["ps"], ["logs"]):
        return
    if args[:3] == ["exec", "-T", "frontend"]:
        if args[3:] in FRONTEND_PERMITIDOS:
            return
        raise Bloqueado(f"en el frontend solo se permite: {', '.join(' '.join(c) for c in FRONTEND_PERMITIDOS)}")
    if args[:3] == ["run", "--rm", "pruebas-pantallas"]:
        resto = args[3:]
        i = 0
        while i < len(resto):
            a = resto[i]
            if a in PLAYWRIGHT_SOLAS:
                i += 1
            elif a in PLAYWRIGHT_CON_VALOR and i + 1 < len(resto):
                i += 2
            elif any(a.startswith(o + "=") for o in PLAYWRIGHT_CON_VALOR if o.startswith("--")):
                i += 1
            else:
                raise Bloqueado(f"opción de Playwright no permitida: {a}")
        return
    raise Bloqueado("docker compose: solo ps, logs, exec -T frontend (pruebas) y run --rm pruebas-pantallas")


def revisar_segmento(seg, perfil):
    while seg and re.fullmatch(r"MSYS_NO_PATHCONV=1", seg[0]):
        seg = seg[1:]
    if not seg:
        return
    if any(es_env(t) for t in seg):
        raise Bloqueado("no se permite leer el archivo .env")
    cab = seg[0]
    if cab == "git":
        return revisar_git(seg[1:])
    if cab in FILTROS:
        if cab == "sort" and any(t == "-o" or t.startswith("--output") for t in seg):
            raise Bloqueado("sort -o escribe un archivo")
        return
    if perfil == "base" and seg[:len(PSQL_LECTURA)] == PSQL_LECTURA:
        return revisar_psql(seg[len(PSQL_LECTURA):])
    if perfil == "pantallas" and seg[:2] == ["docker", "compose"]:
        return revisar_pantallas(seg[2:])
    if perfil == "qa":
        if seg == ["export", "MSYS_NO_PATHCONV=1"]:
            return
        if cab == "sleep" and len(seg) == 2 and seg[1].isdigit():
            return
        if seg[:2] == ["docker", "compose"]:
            return revisar_compose(seg[2:])
    raise Bloqueado(f"'{' '.join(seg)[:80]}' no está en la lista de comandos de consulta (perfil {perfil})")


def revisar(comando, perfil):
    if "`" in comando or "<(" in comando or ">(" in comando:
        raise Bloqueado("no se permiten subcomandos con comillas invertidas ni <( )")
    comando = comando.replace("\\\r\n", " ").replace("\\\n", " ")
    # Subcomandos $( ... ): se revisan por separado
    while True:
        m = re.search(r"\$\(([^()]*)\)", comando)
        if not m:
            break
        revisar(m.group(1), perfil)
        comando = comando[:m.start()] + "SUBCOMANDO" + comando[m.end():]
    # Redirecciones inofensivas
    comando = re.sub(r"\s[12]?>&[12]\b", " ", comando)
    comando = re.sub(r"\s[12]?>\s*/dev/null\b", " ", comando)
    try:
        toks = tokens_de(comando)
    except ValueError as e:
        raise Bloqueado(f"no se pudo leer el comando ({e})")
    segmentos, actual = [], []
    for t in toks:
        if t in {"&&", "||", "|", ";", "\n", ";;"}:
            segmentos.append(actual)
            actual = []
        elif t in {">", ">>", ">|", "&>", "&>>", ">&"}:
            raise Bloqueado("no se permite escribir la salida en archivos (>)")
        elif t in {"&", "(", ")"}:
            raise Bloqueado(f"no se permite '{t}' (segundo plano o subshell)")
        elif t in {"<", "<<"} and perfil != "qa":
            raise Bloqueado("no se permite leer archivos con <")
        else:
            actual.append(t)
    segmentos.append(actual)
    for seg in segmentos:
        revisar_segmento(seg, perfil)


def probar():
    casos = [
        ("consulta", "git status --short", True),
        ("consulta", "git diff $(git merge-base HEAD main)...HEAD --stat", True),
        ("consulta", "git log --oneline -5 && git diff --stat 2>&1 | tail -20", True),
        ("consulta", "git branch -a --contains b16ec0c", True),
        ("consulta", "git branch nueva", False),
        ("consulta", "git branch -D main", False),
        ("consulta", "git checkout main", False),
        ("consulta", "git diff --output=x.txt", False),
        ("consulta", "git log > salida.txt", False),
        ("consulta", "echo hola > prueba.txt", False),
        ("consulta", "cat .env", False),
        ("consulta", "grep -n x .env", False),
        ("consulta", "touch prueba.txt", False),
        ("consulta", "rm -rf backend", False),
        ("consulta", "python -c 'open(\"x\",\"w\")'", False),
        ("consulta", "for f in a b; do git show HEAD:$f; done", False),
        ("consulta", "git diff | tee x.txt", False),
        ("base", 'docker compose exec -T -e PGOPTIONS=-cdefault_transaction_read_only=on db psql -U kennadent -d kennadent_qa -Atc "SELECT relname, relrowsecurity FROM pg_class WHERE relname = \'cita\'"', True),
        ("base", 'docker compose exec -T -e PGOPTIONS=-cdefault_transaction_read_only=on db psql -U kennadent -d kennadent_qa -Atc "SET default_transaction_read_only = off; DELETE FROM cita"', False),
        ("base", 'docker compose exec -T -e PGOPTIONS=-cdefault_transaction_read_only=on db psql -U kennadent -d kennadent_qa -Atc "\\! touch x"', False),
        ("base", 'docker compose exec -T db psql -U kennadent -d kennadent_qa -c "SELECT 1"', False),
        ("base", 'docker compose exec -T -e PGOPTIONS=-cdefault_transaction_read_only=on db psql -U kennadent -d kennadent_qa -o /tmp/x -c "SELECT 1"', False),
        ("consulta", 'docker compose exec -T -e PGOPTIONS=-cdefault_transaction_read_only=on db psql -c "SELECT 1"', False),
        ("qa", "docker compose ps", True),
        ("qa", "docker compose exec -T -e KD_DB_ROL=admin api python manage.py test nucleo -v 2 --noinput 2>&1 | grep -E \"^Ran|OK\"", True),
        ("qa", "export MSYS_NO_PATHCONV=1\ndocker compose exec -T db dropdb -U kennadent --if-exists pruebas \\\n&& docker compose exec -T db createdb -U kennadent pruebas \\\n&& docker compose exec -T db sh -c 'psql -U kennadent -d pruebas -f /kd/pruebas/pruebas_django.sql 2>&1' | grep -E \"^(==|--) |ERROR:\"\ndocker compose exec -T db dropdb -U kennadent --if-exists pruebas", True),
        ("qa", "docker compose down -v && docker compose up -d --build", True),
        ("qa", "MSYS_NO_PATHCONV=1 docker compose exec -T db psql -U kennadent -d espec02 < docs/modelo-datos/pruebas/pruebas_v0.2.sql 2>&1 | grep -c \"ERROR:\"", True),
        ("qa", "docker compose config", False),
        ("qa", "docker compose exec -T api printenv", False),
        ("qa", "docker compose exec -T db psql -c 'select 1' > /tmp/sql_out.txt", False),
        ("qa", "docker inspect kennadent-db-1", False),
        ("qa", "echo x >> backend/nucleo/models/clinico.py", False),
        ("pantallas", "docker compose ps", True),
        ("pantallas", "docker compose exec -T frontend npm run revisar 2>&1 | tail -20", True),
        ("pantallas", "docker compose exec -T frontend npm test", True),
        ("pantallas", "docker compose run --rm pruebas-pantallas --reporter=list 2>&1 | tail -60", True),
        ("pantallas", 'docker compose run --rm pruebas-pantallas -g "contraseña equivocada"', True),
        ("pantallas", "docker compose logs frontend --tail 50", True),
        ("pantallas", "docker compose exec -T frontend npm run formato", False),
        ("pantallas", "docker compose exec -T frontend sh -c 'rm -rf src'", False),
        ("pantallas", "docker compose run --rm pruebas-pantallas --update-snapshots", False),
        ("pantallas", "docker compose run --rm api python manage.py flush", False),
        ("pantallas", "docker compose down -v", False),
        ("pantallas", "docker compose exec -T db psql -c 'select 1'", False),
        ("pantallas", "npm install", False),
    ]
    fallas = 0
    for perfil, cmd, esperado in casos:
        try:
            revisar(cmd, perfil)
            ok = True
        except Bloqueado:
            ok = False
        if ok != esperado:
            fallas += 1
            print(f"FALLA [{perfil}] esperado={'pasa' if esperado else 'bloquea'}: {cmd[:90]}")
    print(f"{len(casos) - fallas} de {len(casos)} casos bien")
    return 1 if fallas else 0


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")   # en Windows la consola no es UTF-8 por omisión
    if sys.argv[1:2] == ["--probar"]:
        sys.exit(probar())
    perfil = sys.argv[1] if len(sys.argv) > 1 else "consulta"
    datos = json.loads(sys.stdin.buffer.read().decode("utf-8") or "{}")
    comando = (datos.get("tool_input") or {}).get("command") or ""
    try:
        revisar(comando, perfil)
    except Bloqueado as e:
        print(f"Bloqueado (agente de solo lectura, perfil {perfil}): {e}. "
              f"Este agente solo consulta; describe lo que haría falta en tu reporte.", file=sys.stderr)
        sys.exit(2)
    # Comando de consulta ya revisado: se aprueba sin pedir permiso. Encender o apagar
    # contenedores (qa-backend, verificación desde cero) sigue el flujo normal de permisos.
    if not (perfil == "qa" and re.search(r"docker\s+compose\s+(down|up)\b", comando)):
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse", "permissionDecision": "allow",
            "permissionDecisionReason": f"Comando de consulta permitido (perfil {perfil})"}}))
    sys.exit(0)


if __name__ == "__main__":
    main()
