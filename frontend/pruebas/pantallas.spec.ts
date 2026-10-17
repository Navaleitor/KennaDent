import { expect, test } from "@playwright/test";

import { ESTADO_KENIA, sinScrollHorizontal, vigilarErrores } from "./ayudantes";

/** Computadora, iPad horizontal y celular (CLAUDE.md, forma de trabajo). */
const TAMANOS = [
  { nombre: "computadora", width: 1366, height: 768 },
  { nombre: "ipad", width: 1024, height: 768 },
  { nombre: "celular", width: 390, height: 844 },
] as const;
const TEMAS = [
  { nombre: "dia", colorScheme: "light" },
  { nombre: "noche", colorScheme: "dark" },
] as const;

for (const tamano of TAMANOS) {
  for (const tema of TEMAS) {
    test.describe(`${tamano.nombre} · modo ${tema.nombre}`, () => {
      test.use({
        viewport: { width: tamano.width, height: tamano.height },
        colorScheme: tema.colorScheme,
        hasTouch: tamano.nombre !== "computadora",
      });

      test("entrada", async ({ page }) => {
        const errores = vigilarErrores(page);
        await page.goto("entrar");
        await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
        await sinScrollHorizontal(page);
        await page.screenshot({ path: `pruebas/capturas/entrada-${tamano.nombre}-${tema.nombre}.png` });
        expect(errores).toEqual([]);
      });

      test.describe("con sesión", () => {
        test.use({ storageState: ESTADO_KENIA });

        test("página de inicio", async ({ page }) => {
          const errores = vigilarErrores(page);
          await page.goto("./");
          await expect(page.getByRole("heading", { name: "Hola, DRA. KENIA NAVARRO" })).toBeVisible();
          await expect(page.getByRole("region", { name: "Mis permisos" })).toBeVisible();
          await sinScrollHorizontal(page);
          await page.screenshot({
            path: `pruebas/capturas/inicio-${tamano.nombre}-${tema.nombre}.png`,
            // En celular, la página completa; en computadora e iPad, lo que se ve en la pantalla
            fullPage: tamano.nombre === "celular",
          });

          const abrirMenu = page.getByRole("button", { name: "Abrir menú" });
          const menu = page.getByRole("complementary", { name: "Menú principal" });
          if (tamano.width <= 960) {
            // Tablet vertical y celular: el menú se abre encima
            await expect(menu).toBeHidden();
            await abrirMenu.click();
            await expect(menu.getByRole("link", { name: /Empresa/ })).toBeVisible();
            // Termina de deslizarse antes de la captura
            await expect.poll(async () => (await menu.boundingBox())?.x).toBe(0);
            await sinScrollHorizontal(page);
            await page.screenshot({ path: `pruebas/capturas/menu-${tamano.nombre}-${tema.nombre}.png` });
            await menu.getByRole("link", { name: /Reportes/ }).click();
            await expect(menu).toBeHidden();
          } else {
            await expect(abrirMenu).toBeHidden();
            await expect(menu.getByText("Gestión")).toBeVisible();
            await menu.getByRole("link", { name: /Reportes/ }).click();
          }
          await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();
          await sinScrollHorizontal(page);
          expect(errores).toEqual([]);
        });
      });
    });
  }
}
