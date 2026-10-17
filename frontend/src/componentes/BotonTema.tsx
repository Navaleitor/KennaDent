import { useState } from "react";

import { cambiarTema, temaActual, type Tema } from "../utilidades/tema";
import { Icono } from "./Icono";

export function BotonTema() {
  const [tema, setTema] = useState<Tema>(temaActual);
  const siguiente: Tema = tema === "dark" ? "light" : "dark";
  const etiqueta = `Cambiar a modo ${siguiente === "dark" ? "noche" : "día"}`;
  return (
    <button
      type="button"
      className="btn-icon sin-borde"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={() => {
        cambiarTema(siguiente);
        setTema(siguiente);
      }}
    >
      <Icono nombre={tema === "dark" ? "sol" : "luna"} />
    </button>
  );
}
