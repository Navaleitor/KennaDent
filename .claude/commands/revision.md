---
description: Revisión completa antes de un PR - lanza los agentes de revisión que aplican según lo que cambió y junta un solo reporte.
argument-hint: "[título y descripción del PR, opcional]"
---

Usa el agente `revision` (subagent_type `revision`), **en primer plano** (`run_in_background: false`) y esperando su reporte final, para revisar la rama actual contra `main` antes de abrir o unir el pull request. Pásale tal cual lo que viene después de esta línea, si hay algo: el título y la descripción del PR, o la indicación de hacer la verificación desde cero.

$ARGUMENTS

Cuando termine, muestra su reporte completo sin resumirlo. No corrijas nada por tu cuenta: si hay hallazgos, pregunta antes qué se arregla.

(El coordinador es un agente porque Claude Code sí permite que un subagente lance otros: hasta 3 niveles, si tiene la herramienta `Agent`. Ver `.claude/agents/revision.md`.)
