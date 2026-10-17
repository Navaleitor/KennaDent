import { Navigate, Outlet } from "react-router";

import { useSesion } from "../api/consultas/sesion";

function Cargando() {
  return (
    <div className="cargando" role="status">
      Cargando…
    </div>
  );
}

function SinConexion({ mensaje, reintentar }: { mensaje: string; reintentar: () => void }) {
  return (
    <div className="cargando">
      <div className="aviso bad" role="alert" style={{ maxWidth: 420 }}>
        <span>
          {mensaje}{" "}
          <button type="button" className="btn btn-ghost" onClick={reintentar}>
            Reintentar
          </button>
        </span>
      </div>
    </div>
  );
}

/** Pantallas con sesión. Sin sesión → entrada; con contraseña inicial → cambiarla primero. */
export function RequiereSesion() {
  const { data, isPending, isError, error, refetch } = useSesion();
  if (isPending) return <Cargando />;
  if (isError && !data) return <SinConexion mensaje={error.message} reintentar={() => void refetch()} />;
  if (!data?.autenticado) return <Navigate to="/entrar" replace />;
  if (data.debe_cambiar_password) return <Navigate to="/cambiar-contrasena" replace />;
  return <Outlet />;
}

/** Cambio de contraseña: necesita sesión, pero no pasa por el bloqueo de la contraseña inicial. */
export function RequiereSesionSinBloqueo() {
  const { data, isPending, isError, error, refetch } = useSesion();
  if (isPending) return <Cargando />;
  if (isError && !data) return <SinConexion mensaje={error.message} reintentar={() => void refetch()} />;
  if (!data?.autenticado) return <Navigate to="/entrar" replace />;
  return <Outlet />;
}

/** La entrada: si ya hay sesión, a la página de inicio. */
export function SoloSinSesion() {
  const { data, isPending, isError, error, refetch } = useSesion();
  if (isPending) return <Cargando />;
  if (isError && !data) return <SinConexion mensaje={error.message} reintentar={() => void refetch()} />;
  if (data?.autenticado) return <Navigate to="/" replace />;
  return <Outlet />;
}
