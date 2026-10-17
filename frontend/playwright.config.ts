import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de flujo completo contra el entorno local (docs/entorno-local.md).
 * Dentro de Docker: docker compose run --rm pruebas-pantallas  →  http://web/app/
 * Usan los usuarios de la demo; la contraseña es KD_DEMO_PASSWORD.
 */
const urlApp = process.env.KD_URL_APP ?? "http://localhost:8080/app/";

export default defineConfig({
  testDir: "./pruebas",
  outputDir: "./test-results",
  // Un solo trabajador: comparten la base de QA y el límite de 10 entradas por minuto
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: urlApp,
    locale: "es-MX",
    timezoneId: "America/Monterrey",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "preparar", testMatch: /preparar\.ts/ },
    {
      name: "flujos",
      testMatch: /flujos\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "pantallas",
      testMatch: /pantallas\.spec\.ts/,
      dependencies: ["preparar"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
