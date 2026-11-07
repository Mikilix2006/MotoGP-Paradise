import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Lógica pura y componentes (U y C). Playwright (e2e/) y endpoints (tests/api/) van aparte.
    include: ["src/**/*.test.{ts,tsx}"],
    // Los tests de componentes declaran `// @vitest-environment jsdom` en su primera línea.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Zona fija: los tests de horas no dependen del PC donde se ejecutan.
    env: { TZ: "Europe/Madrid" },
  },
});
