import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";

import { Proximamente } from "../modulos/proximamente/Proximamente";
import { Inicio } from "../modulos/inicio/Inicio";
import { CambiarPassword } from "../modulos/sesion/CambiarPassword";
import { Entrada } from "../modulos/sesion/Entrada";
import { clienteConsultas } from "./consultas";
import { Diseno } from "./Diseno";
import { RequiereSesion, RequiereSesionSinBloqueo, SoloSinSesion } from "./Guardias";
import { MENU } from "./menu";

function NoEncontrado() {
  return <Proximamente nombre="Página no encontrada" icono="alerta" fase="—" permitido={() => true} />;
}

const rutas = createBrowserRouter(
  [
    { element: <SoloSinSesion />, children: [{ path: "entrar", element: <Entrada /> }] },
    {
      element: <RequiereSesionSinBloqueo />,
      children: [{ path: "cambiar-contrasena", element: <CambiarPassword /> }],
    },
    {
      element: <RequiereSesion />,
      children: [
        {
          element: <Diseno />,
          children: [
            { index: true, element: <Inicio /> },
            ...MENU.filter((item) => item.ruta).map((item) => ({
              path: item.ruta,
              element: (
                <Proximamente
                  nombre={item.nombre}
                  icono={item.icono}
                  fase={item.fase}
                  permitido={item.puede}
                />
              ),
            })),
            { path: "*", element: <NoEncontrado /> },
          ],
        },
      ],
    },
  ],
  { basename: "/app" },
);

export function App() {
  return (
    <QueryClientProvider client={clienteConsultas}>
      <RouterProvider router={rutas} />
    </QueryClientProvider>
  );
}
