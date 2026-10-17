import { useSesion } from "../api/consultas/sesion";

export type Regla = string | ((tiene: (permiso: string) => boolean) => boolean);

/**
 * ¿La persona puede ver esto? (docs/frontend.md §4.2). Es el ÚNICO ayudante que decide
 * qué se muestra. Solo es comodidad: la seguridad real está en la API y en la base.
 *
 *   usePuede("dinero")                               // un permiso
 *   usePuede((tiene) => tiene("cobrar") || tiene("caja"))  // una regla con varios (como el menú)
 */
export function usePuede(regla: Regla): boolean {
  const { data } = useSesion();
  return puede(data?.permisos, regla);
}

/** Lo mismo, sin React (para el menú y las pruebas). */
export function puede(permisos: readonly string[] | undefined, regla: Regla): boolean {
  const tiene = (permiso: string) => Boolean(permisos?.includes(permiso));
  return typeof regla === "string" ? tiene(regla) : regla(tiene);
}
