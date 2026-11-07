import { defineConfig, devices } from "@playwright/test";

// Recorrido real (capa E): build de producción local contra la base motogp_test.
// DATABASE_URL_TEST apunta a esa base; nunca a la de desarrollo ni a producción.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium-escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-iphone", use: { ...devices["iPhone 15"] } },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: "production",
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
    },
  },
});
