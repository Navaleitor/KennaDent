import { Link } from "react-router";

import { Icono } from "../../componentes/Icono";
import { usePuede, type Regla } from "../../utilidades/permisos";
import estilos from "./Proximamente.module.css";

type Props = {
  nombre: string;
  icono: Parameters<typeof Icono>[0]["nombre"];
  fase?: string | undefined;
  /** El permiso que pide la sección, igual que en el menú. */
  permitido: Regla;
};

/** Secciones del menú que todavía no existen en el frontend nuevo (llegan en su fase). */
export function Proximamente({ nombre, icono, fase, permitido }: Props) {
  const puede = usePuede(permitido);

  if (!puede) {
    return (
      <div className={estilos.vacio}>
        <Icono nombre="alerta" tamano={28} />
        <h1>Sin acceso</h1>
        <p>
          Tu usuario no tiene permiso para ver <strong>{nombre}</strong>. Pídele al administrador que lo
          habilite.
        </p>
        <Link className="btn btn-ghost" to="/">
          Ir al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className={estilos.vacio}>
      <Icono nombre={icono} tamano={28} />
      <h1>{nombre}</h1>
      <p>
        Próximamente. Esta sección llega al sistema nuevo en la fase {fase ?? "siguiente"}. Mientras tanto se
        puede ver en el prototipo.
      </p>
      <Link className="btn btn-ghost" to="/">
        Ir al inicio
      </Link>
    </div>
  );
}
