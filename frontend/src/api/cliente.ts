/**
 * Cliente de la API de KennaDent (docs/frontend.md §3 y §4).
 *
 * - Mismo dominio que la API (nginx): la sesión viaja en la cookie, sin CORS.
 * - CSRF: Django entrega la cookie "csrftoken" en GET /api/v1/sesion/; se manda en
 *   el encabezado X-CSRFToken en todo lo que no sea GET.
 * - Errores: el mensaje viene en español desde la API y se muestra tal cual.
 * - 401 (no hay sesión: nunca entró o pasaron 30 min sin uso) y 403 con
 *   codigo "cambiar_password" avisan a la aplicación para que cambie de pantalla.
 */

export const BASE_API = "/api/v1";

export const MENSAJE_SIN_CONEXION =
  "No se pudo conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.";
const MENSAJE_GENERICO = "Algo salió mal en el servidor. Intenta de nuevo en un momento.";

/** Error de la API con el mensaje listo para mostrarse. */
export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string | undefined;
  readonly datos: unknown;

  constructor(mensaje: string, estado: number, codigo?: string, datos?: unknown) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
    this.codigo = codigo;
    this.datos = datos;
  }
}

type Avisos = {
  /** La API respondió 401: ya no hay sesión. */
  alPerderSesion?: () => void;
  /** La API pidió cambiar la contraseña inicial antes de seguir. */
  alPedirCambioPassword?: () => void;
};

let avisos: Avisos = {};

/** La aplicación registra aquí qué hacer ante 401 y "cambia tu contraseña inicial". */
export function configurarAvisos(nuevos: Avisos): void {
  avisos = nuevos;
}

export function leerCookie(nombre: string): string | undefined {
  for (const parte of document.cookie.split(";")) {
    const [llave, ...resto] = parte.trim().split("=");
    if (llave === nombre) return decodeURIComponent(resto.join("="));
  }
  return undefined;
}

/** Convierte el cuerpo de error de DRF en un solo texto: {"detail": "..."} o {"campo": ["..."]}. */
export function mensajeDeError(datos: unknown): string | undefined {
  if (typeof datos === "string") return datos || undefined;
  if (Array.isArray(datos)) {
    const partes = datos.map(mensajeDeError).filter(Boolean);
    return partes.length ? partes.join(" ") : undefined;
  }
  if (datos && typeof datos === "object") {
    const objeto = datos as Record<string, unknown>;
    if (typeof objeto.detail === "string") return objeto.detail;
    const partes = Object.entries(objeto)
      .filter(([llave]) => llave !== "codigo")
      .map(([, valor]) => mensajeDeError(valor))
      .filter(Boolean);
    return partes.length ? partes.join(" ") : undefined;
  }
  return undefined;
}

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type Opciones = {
  metodo?: Metodo;
  cuerpo?: unknown;
  senal?: AbortSignal;
};

async function asegurarCsrf(): Promise<string | undefined> {
  let token = leerCookie("csrftoken");
  if (!token) {
    // GET /sesion/ entrega la cookie CSRF (ensure_csrf_cookie)
    await fetch(`${BASE_API}/sesion/`, { credentials: "same-origin" });
    token = leerCookie("csrftoken");
  }
  return token;
}

/** Hace una petición a la API. `ruta` es relativa a /api/v1 (ej. "/sesion/"). */
export async function pedir<T>(ruta: string, { metodo = "GET", cuerpo, senal }: Opciones = {}): Promise<T> {
  const encabezados: Record<string, string> = { Accept: "application/json" };
  if (cuerpo !== undefined) encabezados["Content-Type"] = "application/json";
  if (metodo !== "GET") {
    const token = await asegurarCsrf();
    if (token) encabezados["X-CSRFToken"] = token;
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE_API}${ruta}`, {
      method: metodo,
      headers: encabezados,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      credentials: "same-origin",
      signal: senal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ErrorApi(MENSAJE_SIN_CONEXION, 0);
  }

  const texto = await respuesta.text();
  let datos: unknown = undefined;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = undefined; // p. ej. una página de error de nginx
    }
  }

  if (respuesta.ok) return datos as T;

  const codigo =
    datos && typeof datos === "object" && typeof (datos as { codigo?: unknown }).codigo === "string"
      ? (datos as { codigo: string }).codigo
      : undefined;
  const mensaje = mensajeDeError(datos) ?? MENSAJE_GENERICO;

  if (respuesta.status === 401) avisos.alPerderSesion?.();
  if (respuesta.status === 403 && codigo === "cambiar_password") avisos.alPedirCambioPassword?.();

  throw new ErrorApi(mensaje, respuesta.status, codigo, datos);
}
