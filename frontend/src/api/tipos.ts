/**
 * Nombres cortos de los tipos GENERADOS desde el esquema OpenAPI de Django.
 * esquema.d.ts no se edita a mano: se regenera (docs/entorno-local.md, "Tipos de la API").
 */
import type { components } from "./esquema";

type Esquemas = components["schemas"];

export type Sesion = Esquemas["Sesion"];
export type Entrada = Esquemas["EntradaRequest"];
export type CambiarPassword = Esquemas["CambiarPasswordRequest"];
export type Mensaje = Esquemas["Mensaje"];
export type Sucursal = Esquemas["Sucursal"];
