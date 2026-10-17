/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const paquete = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
  version: string;
};

// En Docker sobre Windows o Mac los cambios de archivos no siempre avisan: se revisan cada poco (KD_VITE_SONDEO=1)
const sondeo = process.env.KD_VITE_SONDEO === "1";

export default defineConfig({
  // Se sirve detrás de nginx en http://localhost:8080/app/ (mismo dominio que la API)
  base: "/app/",
  plugins: [react()],
  define: { __VERSION__: JSON.stringify(paquete.version) },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // nginx llama al contenedor por su nombre de servicio
    allowedHosts: ["frontend"],
    watch: sondeo ? { usePolling: true, interval: 300 } : undefined,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/pruebas-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
