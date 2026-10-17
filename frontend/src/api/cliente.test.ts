import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configurarAvisos, ErrorApi, MENSAJE_SIN_CONEXION, mensajeDeError, pedir } from "./cliente";

function respuesta(estado: number, cuerpo?: unknown): Response {
  const texto = cuerpo === undefined ? "" : typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
  return new Response(texto || null, { status: estado });
}

const fetchFalso = vi.fn<typeof fetch>();

/** La llamada número `i` a fetch: [url, opciones]. */
function llamada(i: number): Parameters<typeof fetch> {
  const datos = fetchFalso.mock.calls[i];
  if (!datos) throw new Error(`fetch no se llamó ${i + 1} veces`);
  return datos;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchFalso);
  document.cookie = "csrftoken=abc"; // como después de GET /sesion/
});
afterEach(() => {
  fetchFalso.mockReset();
  vi.unstubAllGlobals();
  configurarAvisos({});
});

describe("cliente de la API", () => {
  it("pide con la cookie de sesión, en el mismo dominio", async () => {
    fetchFalso.mockResolvedValueOnce(respuesta(200, { autenticado: false }));
    await expect(pedir("/sesion/")).resolves.toEqual({ autenticado: false });
    const [url, opciones] = llamada(0);
    expect(url).toBe("/api/v1/sesion/");
    expect(opciones?.credentials).toBe("same-origin");
  });

  it("manda el token CSRF de la cookie en lo que no es GET", async () => {
    document.cookie = "csrftoken=abc123";
    fetchFalso.mockResolvedValueOnce(respuesta(200, {}));
    await pedir("/sesion/", { metodo: "POST", cuerpo: { usuario: "x" } });
    const encabezados = llamada(0)[1]?.headers as Record<string, string>;
    expect(encabezados["X-CSRFToken"]).toBe("abc123");
    expect(encabezados["Content-Type"]).toBe("application/json");
  });

  it("si todavía no hay cookie CSRF, primero la pide a /sesion/", async () => {
    document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    fetchFalso.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=nuevo";
      return respuesta(200, { autenticado: false });
    });
    fetchFalso.mockResolvedValueOnce(respuesta(200, {}));
    await pedir("/sesion/", { metodo: "POST", cuerpo: {} });
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect((llamada(1)[1]?.headers as Record<string, string>)["X-CSRFToken"]).toBe("nuevo");
  });

  it("muestra el mensaje de la API tal cual, en español", async () => {
    fetchFalso.mockResolvedValueOnce(respuesta(400, { detail: "Usuario o contraseña incorrectos." }));
    await expect(pedir("/sesion/", { metodo: "POST", cuerpo: {} })).rejects.toMatchObject({
      message: "Usuario o contraseña incorrectos.",
      estado: 400,
    });
  });

  it("junta los errores por campo en un solo mensaje", () => {
    expect(mensajeDeError({ inicio: ["Las citas empiezan solo a las :00 o a las :30."] })).toBe(
      "Las citas empiezan solo a las :00 o a las :30.",
    );
    expect(mensajeDeError({ detail: "x", codigo: "y" })).toBe("x");
  });

  it("401: avisa que ya no hay sesión", async () => {
    const alPerderSesion = vi.fn();
    configurarAvisos({ alPerderSesion });
    fetchFalso.mockResolvedValueOnce(
      respuesta(401, { detail: "No hay sesión", codigo: "not_authenticated" }),
    );
    await expect(pedir("/pacientes/")).rejects.toBeInstanceOf(ErrorApi);
    expect(alPerderSesion).toHaveBeenCalledOnce();
  });

  it('403 "cambiar_password": manda a cambiar la contraseña inicial', async () => {
    const alPedirCambioPassword = vi.fn();
    configurarAvisos({ alPedirCambioPassword });
    fetchFalso.mockResolvedValueOnce(
      respuesta(403, {
        detail: "Antes de continuar, cambia tu contraseña inicial.",
        codigo: "cambiar_password",
      }),
    );
    await expect(pedir("/pacientes/")).rejects.toMatchObject({ estado: 403, codigo: "cambiar_password" });
    expect(alPedirCambioPassword).toHaveBeenCalledOnce();
  });

  it("otro 403 (sin permiso) no cambia de pantalla", async () => {
    const avisos = { alPerderSesion: vi.fn(), alPedirCambioPassword: vi.fn() };
    configurarAvisos(avisos);
    fetchFalso.mockResolvedValueOnce(respuesta(403, { detail: "No tienes permiso para esta acción." }));
    await expect(pedir("/tratamientos/", { metodo: "POST", cuerpo: {} })).rejects.toMatchObject({
      message: "No tienes permiso para esta acción.",
    });
    expect(avisos.alPerderSesion).not.toHaveBeenCalled();
    expect(avisos.alPedirCambioPassword).not.toHaveBeenCalled();
  });

  it("sin conexión: mensaje claro", async () => {
    fetchFalso.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(pedir("/sesion/")).rejects.toMatchObject({ message: MENSAJE_SIN_CONEXION, estado: 0 });
  });

  it("respuesta que no es JSON (ej. 502 de nginx): mensaje genérico en español", async () => {
    fetchFalso.mockResolvedValueOnce(respuesta(502, "<html>Bad Gateway</html>"));
    await expect(pedir("/sesion/")).rejects.toMatchObject({
      estado: 502,
      message: expect.stringMatching(/servidor/),
    });
  });

  it("204 sin cuerpo (cerrar sesión) no falla", async () => {
    document.cookie = "csrftoken=abc";
    fetchFalso.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(pedir("/sesion/", { metodo: "DELETE" })).resolves.toBeUndefined();
  });
});
