import type { NombreIcono } from "../componentes/Icono";
import { puede } from "../utilidades/permisos";

/**
 * Menú lateral: los mismos bloques, secciones y permisos que el prototipo (js/app.js, NAV).
 * "Principal" es la operación diaria; "Gestión" es para perfiles administrativos y gerenciales.
 * "fase" dice en qué fase de docs/frontend.md §6 llega cada sección (mientras tanto: "Próximamente").
 */
export type ItemMenu = {
  grupo: "Principal" | "Gestión";
  ruta: string;
  nombre: string;
  icono: NombreIcono;
  puede: (tiene: (permiso: string) => boolean) => boolean;
  fase?: string;
};

export const MENU: readonly ItemMenu[] = [
  { grupo: "Principal", ruta: "", nombre: "Inicio", icono: "inicio", puede: () => true },
  {
    grupo: "Principal",
    ruta: "dashboard",
    nombre: "Dashboard",
    icono: "panel",
    puede: (t) => t("panel"),
    fase: "F3",
  },
  {
    grupo: "Principal",
    ruta: "agenda",
    nombre: "Agenda",
    icono: "agenda",
    puede: (t) => t("agenda_ver"),
    fase: "F2",
  },
  {
    grupo: "Principal",
    ruta: "pacientes",
    nombre: "Pacientes",
    icono: "pacientes",
    puede: (t) => t("pacientes_ver"),
    fase: "F1",
  },
  {
    grupo: "Principal",
    ruta: "seguimiento",
    nombre: "Seguimiento",
    icono: "seguimiento",
    puede: (t) => t("seguimiento"),
    fase: "F3",
  },
  {
    grupo: "Principal",
    ruta: "caja",
    nombre: "Caja",
    icono: "caja",
    puede: (t) => t("cobrar") || t("caja"),
    fase: "F3",
  },
  {
    grupo: "Principal",
    ruta: "material",
    nombre: "Solicitar material",
    icono: "material",
    puede: (t) => t("material_solicitar") && !t("inventario"),
    fase: "F3",
  },
  {
    grupo: "Gestión",
    ruta: "presupuestos",
    nombre: "Presupuestos",
    icono: "presupuestos",
    puede: (t) => t("presupuestos"),
    fase: "F3",
  },
  {
    grupo: "Gestión",
    ruta: "reportes",
    nombre: "Reportes",
    icono: "reportes",
    puede: (t) => t("reportes"),
    fase: "F3",
  },
  {
    grupo: "Gestión",
    ruta: "inventario",
    nombre: "Inventario",
    icono: "inventario",
    puede: (t) => t("inventario"),
    fase: "F3",
  },
  {
    grupo: "Gestión",
    ruta: "tratamientos",
    nombre: "Tratamientos",
    icono: "tratamientos",
    puede: (t) => t("tratamientos"),
    fase: "F3",
  },
  {
    grupo: "Gestión",
    ruta: "personal",
    nombre: "Personal",
    icono: "personal",
    puede: (t) => t("personal"),
    fase: "F3",
  },
  {
    grupo: "Gestión",
    ruta: "empresa",
    nombre: "Empresa",
    icono: "empresa",
    puede: (t) => t("empresa"),
    fase: "F3",
  },
];

/** Lo que esta persona puede ver del menú. */
export function menuPara(permisos: readonly string[] | undefined): ItemMenu[] {
  return MENU.filter((item) => puede(permisos, item.puede));
}
