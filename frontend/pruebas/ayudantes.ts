import { expect, type Page } from "@playwright/test";

export const CLAVE_DEMO = process.env.KD_DEMO_PASSWORD ?? "kennadent2026";
export const ESTADO_KENIA = "pruebas/.estado/kenia.json";

/** Junta los errores de JavaScript de la página (y los de consola, salvo las respuestas 4xx esperadas). */
export function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) {
      errores.push(`console: ${m.text()}`);
    }
  });
  return errores;
}

export async function entrar(page: Page, empresa: string, usuario: string, clave: string = CLAVE_DEMO) {
  await page.goto("entrar");
  await page.getByLabel("Clínica").fill(empresa);
  await page.getByLabel("Usuario").fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function salir(page: Page) {
  await page.getByRole("button", { name: "Menú de usuario" }).click();
  await page.getByRole("menuitem", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/app\/entrar$/);
}

/** Sin scroll horizontal (CLAUDE.md, forma de trabajo). */
export async function sinScrollHorizontal(page: Page) {
  const { ancho, visible } = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    visible: document.documentElement.clientWidth,
  }));
  expect(ancho, "la página no debe tener scroll horizontal").toBeLessThanOrEqual(visible);
}
