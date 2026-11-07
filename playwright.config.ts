import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Dos modos:
// - Local (sin BASE_URL): build de producción en el puerto 3100 contra la base
//   motogp_test (scripts/test/preparar-bd-test.sh). Nunca la de desarrollo.
// - Remoto (BASE_URL=http://www.planetamiguel.com): sin servidor propio; solo
//   tiene sentido el proyecto "api" (comprobaciones de solo lectura).
const PORT = 3100;
const remote = process.env.BASE_URL;

// La URL de motogp_test sale de la DATABASE_URL de .env cambiando solo el nombre de la base.
function testDatabaseUrl(): string {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  try {
    const line = readFileSync(".env", "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
    const url = line?.slice("DATABASE_URL=".length).replace(/^"|"$/g, "") ?? "";
    return url.replace(/\/[^/?]+(\?|$)/, "/motogp_test$1");
  } catch {
    return "";
  }
}

export default defineConfig({
  testDir: ".",
  // Los worktrees de agentes (.claude/worktrees) tienen copias de los tests.
  testIgnore: ["**/.claude/**", "**/node_modules/**"],
  fullyParallel: true,
  // Un único servidor local: con muchos workers los endpoints pesados tardan más de 5 s.
  workers: process.env.CI ? 1 : 4,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: remote ?? `http://localhost:${PORT}`,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "api", testMatch: "tests/api/**/*.spec.ts" },
    { name: "chromium-escritorio", testMatch: "e2e/**/*.spec.ts", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-iphone", testMatch: "e2e/**/*.spec.ts", use: { ...devices["iPhone 15"] } },
  ],
  webServer: remote
    ? undefined
    : {
        command: `npx next build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        timeout: 300_000,
        reuseExistingServer: false,
        env: { NODE_ENV: "production", DATABASE_URL: testDatabaseUrl() },
      },
});
