import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { pedir } from "../cliente";
import type { CambiarPassword, Entrada, Mensaje, Sesion, Sucursal } from "../tipos";

export const LLAVE_SESION = ["sesion"] as const;
/** Por qué se regresó a la entrada (se muestra una vez en la pantalla de entrada). */
export const LLAVE_AVISO_SALIDA = ["aviso-salida"] as const;
export type AvisoSalida = "inactividad" | "salio";

const SIN_SESION: Sesion = { autenticado: false };

/** Quién soy, mis permisos y mis sucursales (GET /api/v1/sesion/). */
export function useSesion() {
  const cliente = useQueryClient();
  return useQuery({
    queryKey: LLAVE_SESION,
    queryFn: async ({ signal }) => {
      const anterior = cliente.getQueryData<Sesion>(LLAVE_SESION);
      const sesion = await pedir<Sesion>("/sesion/", { senal: signal });
      // Tenía sesión y el servidor ya no la reconoce: se cerró por 30 minutos sin uso
      if (anterior?.autenticado && !sesion.autenticado) {
        olvidarSesion(cliente, "inactividad");
        return SIN_SESION;
      }
      return sesion;
    },
    staleTime: 60_000,
  });
}

export function useAvisoSalida(): AvisoSalida | undefined {
  const { data } = useQuery<AvisoSalida | null>({
    queryKey: LLAVE_AVISO_SALIDA,
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  });
  return data ?? undefined;
}

/** Deja la sesión como "cerrada" en la memoria de la pantalla y olvida todos los datos que se pidieron. */
export function olvidarSesion(cliente: QueryClient, aviso?: AvisoSalida): void {
  cliente.removeQueries({ predicate: (consulta) => consulta.queryKey[0] !== LLAVE_SESION[0] });
  cliente.setQueryData(LLAVE_SESION, SIN_SESION);
  if (aviso) cliente.setQueryData(LLAVE_AVISO_SALIDA, aviso);
}

export function useEntrar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (datos: Entrada) => pedir<Sesion>("/sesion/", { metodo: "POST", cuerpo: datos }),
    onSuccess: (sesion) => {
      cliente.removeQueries({ predicate: (consulta) => consulta.queryKey[0] !== LLAVE_SESION[0] });
      cliente.setQueryData(LLAVE_SESION, sesion);
    },
  });
}

export async function cerrarSesion(cliente: QueryClient, aviso: AvisoSalida = "salio"): Promise<void> {
  try {
    await pedir<unknown>("/sesion/", { metodo: "DELETE" });
  } catch {
    // Sin conexión o la sesión ya había vencido: en la pantalla se cierra de todos modos
  } finally {
    olvidarSesion(cliente, aviso);
  }
}

export function useSalir() {
  const cliente = useQueryClient();
  return useMutation({ mutationFn: () => cerrarSesion(cliente) });
}

export function useCambiarPassword() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (datos: CambiarPassword) =>
      pedir<Mensaje>("/sesion/password/", { metodo: "POST", cuerpo: datos }),
    onSuccess: () => {
      // Al instante (para poder pasar a la página de inicio) y luego se confirma con la API
      cliente.setQueryData<Sesion>(LLAVE_SESION, (s) => (s ? { ...s, debe_cambiar_password: false } : s));
      return cliente.invalidateQueries({ queryKey: LLAVE_SESION });
    },
  });
}

/** Sucursales que puedo ver, con sus sillones (GET /api/v1/sucursales/). */
export function useSucursales() {
  return useQuery({
    queryKey: ["sucursales"],
    queryFn: ({ signal }) => pedir<Sucursal[]>("/sucursales/", { senal: signal }),
  });
}
