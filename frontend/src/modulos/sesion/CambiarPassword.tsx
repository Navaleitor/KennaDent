import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";

import { useCambiarPassword, useSalir, useSesion } from "../../api/consultas/sesion";
import { BotonTema } from "../../componentes/BotonTema";
import { Icono } from "../../componentes/Icono";
import { Marca } from "../../componentes/Marca";
import estilos from "./Sesion.module.css";

// Las reglas finales las pone la API (Django); aquí solo se avisa antes de enviar
const esquema = z
  .object({
    actual: z.string().min(1, "Escribe tu contraseña actual."),
    nueva: z
      .string()
      .min(8, "La contraseña nueva debe tener al menos 8 caracteres.")
      .refine((valor) => !/^\d+$/.test(valor), "La contraseña nueva no puede ser solo números."),
    confirmar: z.string().min(1, "Vuelve a escribir la contraseña nueva."),
  })
  .refine((d) => d.nueva === d.confirmar, {
    path: ["confirmar"],
    message: "Las dos contraseñas no coinciden.",
  })
  .refine((d) => d.nueva !== d.actual, {
    path: ["nueva"],
    message: "La contraseña nueva debe ser distinta.",
  });
type Datos = z.infer<typeof esquema>;

/**
 * Cambio de contraseña. Con la contraseña inicial (o regenerada por el administrador)
 * es obligatorio: no se deja usar nada más hasta cambiarla (requisitos §6).
 */
export function CambiarPassword() {
  const { data: sesion } = useSesion();
  const obligatorio = Boolean(sesion?.debe_cambiar_password);
  const cambiar = useCambiarPassword();
  const salir = useSalir();
  const navegar = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { actual: "", nueva: "", confirmar: "" },
  });

  const enviar = handleSubmit((datos) =>
    cambiar.mutate(
      { actual: datos.actual, nueva: datos.nueva },
      { onSuccess: () => navegar("/", { replace: true, state: { passwordCambiada: true } }) },
    ),
  );

  return (
    <main className={estilos.pantalla}>
      <div className={estilos.esquina}>
        <BotonTema />
      </div>
      <section className={`card ${estilos.tarjeta}`} aria-labelledby="titulo-password">
        <div className={estilos.encabezado}>
          <Marca subtitulo={sesion?.empresa?.nombre} />
          <div>
            <h1 id="titulo-password">
              {obligatorio ? "Cambia tu contraseña inicial" : "Cambiar contraseña"}
            </h1>
            <p>
              {obligatorio
                ? "Antes de continuar, elige una contraseña que solo tú conozcas."
                : "Elige una contraseña que solo tú conozcas."}
            </p>
          </div>
        </div>

        {obligatorio ? (
          <div className="aviso warn" role="status">
            <Icono nombre="candado" />
            <span>
              Entraste con una contraseña inicial. Por seguridad, no podrás usar el sistema hasta cambiarla.
            </span>
          </div>
        ) : null}
        {cambiar.isError ? (
          <div className="aviso bad" role="alert">
            <Icono nombre="alerta" />
            <span>{cambiar.error.message}</span>
          </div>
        ) : null}

        <form className={estilos.formulario} onSubmit={enviar} noValidate>
          <label className="campo">
            <span>Contraseña actual</span>
            <input
              {...register("actual")}
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.actual ? true : undefined}
              className={errors.actual ? "invalido" : undefined}
              autoFocus
            />
            {errors.actual ? <span className="error">{errors.actual.message}</span> : null}
          </label>
          <label className="campo">
            <span>Contraseña nueva</span>
            <input
              {...register("nueva")}
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.nueva ? true : undefined}
              className={errors.nueva ? "invalido" : undefined}
            />
            {errors.nueva ? <span className="error">{errors.nueva.message}</span> : null}
          </label>
          <label className="campo">
            <span>Repite la contraseña nueva</span>
            <input
              {...register("confirmar")}
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.confirmar ? true : undefined}
              className={errors.confirmar ? "invalido" : undefined}
            />
            {errors.confirmar ? <span className="error">{errors.confirmar.message}</span> : null}
          </label>
          <ul className={estilos.reglas}>
            <li>Al menos 8 caracteres.</li>
            <li>Que no sea solo números ni una contraseña muy común.</li>
          </ul>
          <button className="btn btn-bloque" type="submit" disabled={cambiar.isPending}>
            {cambiar.isPending ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>

        <div className={estilos.pie}>
          {obligatorio ? (
            <button type="button" className="btn btn-ghost btn-bloque" onClick={() => salir.mutate()}>
              <Icono nombre="salir" /> Salir sin cambiarla
            </button>
          ) : (
            <Link to="/">Cancelar y regresar</Link>
          )}
        </div>
      </section>
    </main>
  );
}
