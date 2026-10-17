// Genera los íconos PNG de "Agregar a pantalla de inicio" desde public/iconos/icono-cuadrado.svg.
// Solo hace falta si cambia el logo. Uso (con el entorno levantado):
//   docker compose run --rm --no-deps --entrypoint node pruebas-pantallas docker/generar-iconos.mjs
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync(new URL("../public/iconos/icono-cuadrado.svg", import.meta.url), "utf-8");
const navegador = await chromium.launch();
for (const tamano of [180, 192, 512]) {
  const pagina = await navegador.newPage({ viewport: { width: tamano, height: tamano } });
  await pagina.setContent(
    `<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${tamano}" height="${tamano}" `)}</body></html>`,
  );
  await pagina.screenshot({ path: `public/iconos/icono-${tamano}.png`, omitBackground: false });
  await pagina.close();
}
await navegador.close();
console.log("Íconos listos en public/iconos/");
