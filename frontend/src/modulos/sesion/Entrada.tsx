import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAvisoSalida, useEntrar } from "../../api/consultas/sesion";
import { BotonTema } from "../../componentes/BotonTema";
import { Icono } from "../../componentes/Icono";
import { Marca } from "../../componentes/Marca";
import { VERSION } from "../../utilidades/texto";
import estilos from "./Sesion.module.css";

/** Solo el código de la clínica se recuerda en el dispositivo; nunca usuario ni contraseña. */
const LLAVE_CLINICA = "kennadent-clinica";

function clinicaRecordada(): string {
  try {
    return localStorage.getItem(LLAVE_CLINICA) ?? "";
  } catch {
    return "";
  }
}

function recordarClinica(codigo: string): void {
  try {
    localStorage.setItem(LLAVE_CLINICA, codigo);
  } catch {
    // almacenamiento bloqueado: no pasa nada, se vuelve a escribir la próxima vez
  }
}

const esquema = z.object({
  empresa: z.string().trim().min(1, "Escribe el código de tu clínica."),
  usuario: z.string().trim().min(1, "Escribe tu usuario (nombre.apellido)."),
  password: z.string().min(1, "Escribe tu contraseña."),
});
type Datos = z.infer<typeof esquema>;

const AVISOS = {
  inactividad: "Tu sesión se cerró por inactividad (30 minutos sin uso). Vuelve a entrar.",
  salio: "Saliste del sistema.",
} as const;

export function Entrada() {
  const aviso = useAvisoSalida();
  const entrar = useEntrar();
  const clinica = clinicaRecordada();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { empresa: clinica, usuario: "", password: "" },
  });

  const enviar = handleSubmit((datos) => {
    const codigo = datos.empresa.toLowerCase();
    entrar.mutate(
      { empresa: codigo, usuario: datos.usuario.toLowerCase(), password: datos.password },
      { onSuccess: () => recordarClinica(codigo) },
    );
  });

  return (
    <main className={estilos.pantalla}>
      <div className={estilos.esquina}>
        <BotonTema />
      </div>
      <section className={`card ${estilos.tarjeta}`} aria-labelledby="titulo-entrada">
        <div className={estilos.encabezado}>
          <Marca subtitulo="Gestión dental" />
          <div>
            <h1 id="titulo-entrada">Entrar</h1>
            <p>Con el código de tu clínica, tu usuario y tu contraseña.</p>
          </div>
        </div>

        {aviso && !entrar.isError ? (
          <div className="aviso info" role="status">
            <Icono nombre={aviso === "inactividad" ? "reloj" : "info"} />
            <span>{AVISOS[aviso]}</span>
          </div>
        ) : null}
        {entrar.isError ? (
          <div className="aviso bad" role="alert">
            <Icono nombre="alerta" />
            <span>{entrar.error.message}</span>
          </div>
        ) : null}

        <form className={estilos.formulario} onSubmit={enviar} noValidate>
          <label className="campo">
            <span>Clínica</span>
            <input
              {...register("empresa")}
              autoComplete="organization"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="ej. demo"
              aria-invalid={errors.empresa ? true : undefined}
              className={errors.empresa ? "invalido" : undefined}
              autoFocus={!clinica}
            />
            {errors.empresa ? <span className="error">{errors.empresa.message}</span> : null}
          </label>
          <label className="campo">
            <span>Usuario</span>
            <input
              {...register("usuario")}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="nombre.apellido"
              aria-invalid={errors.usuario ? true : undefined}
              className={errors.usuario ? "invalido" : undefined}
              autoFocus={Boolean(clinica)}
            />
            {errors.usuario ? <span className="error">{errors.usuario.message}</span> : null}
          </label>
          <label className="campo">
            <span>Contraseña</span>
            <input
              {...register("password")}
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              className={errors.password ? "invalido" : undefined}
            />
            {errors.password ? <span className="error">{errors.password.message}</span> : null}
          </label>
          <button className="btn btn-bloque" type="submit" disabled={entrar.isPending}>
            {entrar.isPending ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className={estilos.pie}>
          <span>¿Olvidaste tu contraseña? Pídele al administrador de tu clínica una nueva.</span>
          <span>Versión {VERSION}</span>
        </div>
      </section>
    </main>
  );
}
