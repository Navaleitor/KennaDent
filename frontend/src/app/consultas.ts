import { QueryClient } from "@tanstack/react-query";

import { configurarAvisos, ErrorApi } from "../api/cliente";
import { LLAVE_SESION, olvidarSesion } from "../api/consultas/sesion";
import type { Sesion } from "../api/tipos";

export const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      // Un error de la API (400, 401, 403…) no se reintenta; un fallo de red, una vez
      retry: (intentos, error) => !(error instanceof ErrorApi && error.estado >= 400) && intentos < 1,
      staleTime: 15_000,
    },
  },
});

// La API avisa por el cliente: 401 = ya no hay sesión; 403 "cambiar_password" = contraseña inicial
configurarAvisos({
  alPerderSesion: () => {
    if (clienteConsultas.getQueryData<Sesion>(LLAVE_SESION)?.autenticado) {
      olvidarSesion(clienteConsultas, "inactividad");
    }
  },
  alPedirCambioPassword: () => {
    clienteConsultas.setQueryData<Sesion>(LLAVE_SESION, (s) =>
      s ? { ...s, debe_cambiar_password: true } : s,
    );
  },
});
