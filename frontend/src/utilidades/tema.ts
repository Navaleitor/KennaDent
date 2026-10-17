/** Modo día y noche. Misma llave que el prototipo: si cambias el tema en uno, el otro lo respeta. */
const LLAVE = "kennadent-tema";

export type Tema = "light" | "dark";

export function temaActual(): Tema {
  const elegido = document.documentElement.dataset.theme;
  if (elegido === "light" || elegido === "dark") return elegido;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function cambiarTema(tema: Tema): void {
  document.documentElement.dataset.theme = tema;
  try {
    localStorage.setItem(LLAVE, tema);
  } catch {
    // Navegación privada o almacenamiento bloqueado: el tema dura solo esta visita
  }
}
