import { expect, test as preparar } from "@playwright/test";

import { entrar, ESTADO_KENIA } from "./ayudantes";

// Una sola entrada para todas las pruebas de tamaños de pantalla (cuida el límite de 10 por minuto)
preparar("entrar como la administradora", async ({ page }) => {
  await entrar(page, "demo", "kenia.navarro");
  await expect(page.getByRole("heading", { name: "Hola, DRA. KENIA NAVARRO" })).toBeVisible();
  await page.context().storageState({ path: ESTADO_KENIA });
});
