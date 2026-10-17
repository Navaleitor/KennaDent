import { useEffect, useRef } from "react";

/** 30 minutos sin uso, igual que la sesión de la API (requisitos §6). */
export const MINUTOS_SIN_USO = 30;

const EVENTOS_DE_USO = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
const REVISAR_CADA_MS = 15_000;

/**
 * Llama a `alVencer` cuando la persona no toca la pantalla en `minutos`.
 *
 * El servidor también cierra la sesión a los 30 minutos sin peticiones, pero una pantalla
 * que se refresca sola (la agenda, en la F2) la mantendría viva para siempre. Además,
 * en un iPad compartido no deben quedar datos de pacientes a la vista.
 * Se mide con la hora del reloj (no con un temporizador largo) porque Safari pausa
 * los temporizadores cuando el iPad se bloquea o la pestaña queda atrás.
 */
export function useInactividad(alVencer: () => void, minutos: number = MINUTOS_SIN_USO): void {
  const ultimoUso = useRef(0); // se fija al montar (abajo)
  const avisar = useRef(alVencer);

  useEffect(() => {
    avisar.current = alVencer;
  }, [alVencer]);

  useEffect(() => {
    const limite = minutos * 60_000;
    let vencido = false;
    ultimoUso.current = Date.now();

    const revisar = () => {
      if (!vencido && Date.now() - ultimoUso.current >= limite) {
        vencido = true;
        avisar.current();
      }
    };
    const marcarUso = () => {
      revisar(); // si regresa después del límite, primero se cierra
      if (!vencido) ultimoUso.current = Date.now();
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") revisar();
    };

    for (const evento of EVENTOS_DE_USO) window.addEventListener(evento, marcarUso, { passive: true });
    document.addEventListener("visibilitychange", alVolver);
    const intervalo = window.setInterval(revisar, REVISAR_CADA_MS);
    return () => {
      for (const evento of EVENTOS_DE_USO) window.removeEventListener(evento, marcarUso);
      document.removeEventListener("visibilitychange", alVolver);
      window.clearInterval(intervalo);
    };
  }, [minutos]);
}
