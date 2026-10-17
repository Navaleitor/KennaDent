/** Iniciales para el avatar: "DRA. ANDREA GARZA LEAL" → "AG" (sin el título). */
export function iniciales(nombre: string | undefined): string {
  const palabras = (nombre ?? "")
    .replace(/^(DR|DRA)\.\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return palabras
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

/** "demo/andrea.garza" → "andrea.garza" (la clínica ya se escribe en su propio campo). */
export function usuarioSinClinica(login: string | undefined): string {
  return (login ?? "").split("/").pop() ?? "";
}

/** Orden de los grupos de permisos, como en js/roles.js. */
export const ORDEN_GRUPOS = ["General", "Agenda", "Pacientes", "Historial clínico", "Operación", "Gestión"];

export const VERSION: string = __VERSION__;
