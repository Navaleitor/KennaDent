import { expect, test } from "@playwright/test";

import { CLAVE_DEMO, entrar, salir, vigilarErrores } from "./ayudantes";

test.describe("sesión", () => {
  test("entrar, ver la página de inicio y salir (recepción)", async ({ page }) => {
    const errores = vigilarErrores(page);
    await entrar(page, "demo", "daniela.flores");

    await expect(page.getByRole("heading", { name: "Hola, DANIELA FLORES ROJAS" })).toBeVisible();
    await expect(page.getByText("Recepcionista").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Mis sucursales" }).getByText("CUMBRES")).toBeVisible();
    await expect(page.getByText("Cobrar a pacientes")).toBeVisible();

    // El menú solo muestra lo que puede ver: recepción cobra, pero no tiene Gestión
    const menu = page.getByRole("complementary", { name: "Menú principal" });
    await expect(menu.getByRole("link", { name: /Caja/ })).toBeVisible();
    await expect(menu.getByRole("link", { name: /Presupuestos/ })).toHaveCount(0);
    await expect(menu.getByText("Gestión")).toHaveCount(0);
    await expect(menu.getByText(/Versión \d+\.\d+\.\d+/)).toBeVisible();

    await salir(page);
    await expect(page.getByText("Saliste del sistema.")).toBeVisible();
    // Ya sin sesión, la página de inicio regresa a la entrada
    await page.goto("./");
    await expect(page).toHaveURL(/\/app\/entrar$/);
    expect(errores).toEqual([]);
  });

  test("contraseña equivocada", async ({ page }) => {
    const errores = vigilarErrores(page);
    await entrar(page, "demo", "andrea.garza", "no-es-la-clave");
    await expect(page.getByRole("alert")).toHaveText("Usuario o contraseña incorrectos.");
    await expect(page).toHaveURL(/\/app\/entrar$/);
    expect(errores).toEqual([]);
  });

  test("campos vacíos: se avisa sin llamar a la API", async ({ page }) => {
    await page.goto("entrar");
    await page.getByLabel("Clínica").fill("");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Escribe el código de tu clínica.")).toBeVisible();
    await expect(page.getByText("Escribe tu contraseña.")).toBeVisible();
  });

  test("con contraseña inicial, obliga a cambiarla antes de usar nada", async ({ page }) => {
    // El servicio preparar-pruebas deja a bruno.salas con la contraseña inicial de la demo
    const errores = vigilarErrores(page);
    await entrar(page, "aislamiento", "bruno.salas");
    await expect(page).toHaveURL(/\/app\/cambiar-contrasena$/);
    await expect(page.getByRole("heading", { name: "Cambia tu contraseña inicial" })).toBeVisible();

    // No deja ir a ningún otro lado
    await page.goto("./");
    await expect(page).toHaveURL(/\/app\/cambiar-contrasena$/);

    const nueva = `Prueba-${Date.now()}`;
    await page.getByLabel("Contraseña actual", { exact: true }).fill(CLAVE_DEMO);
    await page.getByLabel("Contraseña nueva", { exact: true }).fill(nueva);
    await page.getByLabel("Repite la contraseña nueva").fill("otra-cosa");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByText("Las dos contraseñas no coinciden.")).toBeVisible();

    await page.getByLabel("Repite la contraseña nueva").fill(nueva);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByRole("heading", { name: /Hola, DR\. BRUNO SALAS ORTEGA/ })).toBeVisible();
    await expect(page.getByText("Tu contraseña se guardó.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Mis sucursales" })).toBeVisible();
    await salir(page);
    expect(errores).toEqual([]);
  });

  test("30 minutos sin tocar la pantalla: regresa a la entrada con aviso", async ({ page }) => {
    await page.clock.install();
    await entrar(page, "demo", "andrea.garza");
    await expect(page.getByRole("heading", { name: "Hola, DRA. ANDREA GARZA LEAL" })).toBeVisible();
    await page.clock.fastForward("31:00");
    await expect(page).toHaveURL(/\/app\/entrar$/);
    await expect(page.getByRole("status")).toHaveText(/Tu sesión se cerró por inactividad/);
  });

  test("si el servidor ya cerró la sesión, regresa a la entrada con aviso", async ({ page, context }) => {
    await page.clock.install();
    await entrar(page, "demo", "andrea.garza");
    await expect(page.getByRole("heading", { name: "Hola, DRA. ANDREA GARZA LEAL" })).toBeVisible();

    // Como si hubieran pasado 30 minutos sin peticiones: el servidor ya no reconoce la cookie
    await context.clearCookies({ name: "sessionid" });
    await page.clock.fastForward("02:00");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
    await expect(page).toHaveURL(/\/app\/entrar$/);
    await expect(page.getByRole("status")).toHaveText(/Tu sesión se cerró por inactividad/);
  });
});

test.describe("permisos", () => {
  test("la odontóloga no ve Caja y, si entra directo, ve Sin acceso", async ({ page }) => {
    const errores = vigilarErrores(page);
    await entrar(page, "demo", "andrea.garza");
    const menu = page.getByRole("complementary", { name: "Menú principal" });
    await expect(menu.getByRole("link", { name: /Solicitar material/ })).toBeVisible();
    await expect(menu.getByRole("link", { name: /Caja/ })).toHaveCount(0);

    await menu.getByRole("link", { name: /Agenda/ }).click();
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
    await expect(page.getByText(/Próximamente/)).toBeVisible();

    await page.goto("caja");
    await expect(page.getByRole("heading", { name: "Sin acceso" })).toBeVisible();
    await salir(page);
    expect(errores).toEqual([]);
  });
});
