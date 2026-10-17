import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { menuPara } from "../app/menu";
import { LLAVE_SESION } from "../api/consultas/sesion";
import type { Sesion } from "../api/tipos";
import { puede, usePuede } from "./permisos";

// Permisos de la demo (backend/nucleo/migrations/0003_catalogos.py)
const RECEPCION = [
  "panel",
  "agenda_ver",
  "agenda_todas",
  "agenda_editar",
  "pacientes_ver",
  "pacientes_editar",
  "seguimiento",
  "cobrar",
];
const ODONTOLOGA = [
  "panel",
  "agenda_ver",
  "pacientes_ver",
  "clinico_editar",
  "historial_ver",
  "historial_editar",
  "material_solicitar",
];

function conSesion(permisos: string[]) {
  const cliente = new QueryClient();
  cliente.setQueryData<Sesion>(LLAVE_SESION, { autenticado: true, permisos });
  return function Proveedor({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  };
}

describe("usePuede", () => {
  it("decide con los permisos de GET /sesion/", () => {
    const { result } = renderHook(() => [usePuede("cobrar"), usePuede("dinero")], {
      wrapper: conSesion(RECEPCION),
    });
    expect(result.current).toEqual([true, false]);
  });

  it("acepta una regla con varios permisos (como el menú)", () => {
    const { result } = renderHook(() => usePuede((tiene) => tiene("cobrar") || tiene("caja")), {
      wrapper: conSesion(RECEPCION),
    });
    expect(result.current).toBe(true);
  });

  it("sin sesión no puede nada", () => {
    expect(puede(undefined, "panel")).toBe(false);
    expect(puede([], (t) => t("caja"))).toBe(false);
  });
});

describe("menú según los permisos", () => {
  it("recepción: Principal con caja, sin Gestión", () => {
    const rutas = menuPara(RECEPCION).map((i) => i.ruta);
    expect(rutas).toEqual(["", "dashboard", "agenda", "pacientes", "seguimiento", "caja"]);
    expect(menuPara(RECEPCION).some((i) => i.grupo === "Gestión")).toBe(false);
  });

  it("odontóloga: solicita material y no ve caja", () => {
    const rutas = menuPara(ODONTOLOGA).map((i) => i.ruta);
    expect(rutas).toContain("material");
    expect(rutas).not.toContain("caja");
  });

  it("quien tiene inventario no ve Solicitar material (igual que el prototipo)", () => {
    const rutas = menuPara(["material_solicitar", "inventario"]).map((i) => i.ruta);
    expect(rutas).toEqual(["", "inventario"]);
  });

  it("Inicio siempre está", () => {
    expect(menuPara([]).map((i) => i.nombre)).toEqual(["Inicio"]);
  });
});
