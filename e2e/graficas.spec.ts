// Recorridos de /graficas (capa E de TESTS.md) en Chromium escritorio y WebKit iPhone.
// Temporada 2024 de MotoGP: cerrada y con datos en motogp_test.
import { expect, test, type Page } from "@playwright/test";

const URL_2024 = "/graficas?temporada=2024&categoria=3";

const boxes = (page: Page) => page.getByRole("checkbox");
const chart = (page: Page) => page.getByRole("group", { name: /^Gráfica de/ });

async function loaded(page: Page) {
  await expect(page.getByRole("status", { name: /^Cargando/ })).toHaveCount(0, { timeout: 20_000 });
  await expect(chart(page)).toBeVisible();
}

test.describe("Gráficas", () => {
  test("GRA-E01 carga con el top 5, leyenda-selector única y menú activo, sin errores", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(e.message));
    page.on("console", (m) => m.type() === "error" && problems.push(m.text()));

    await page.goto(URL_2024);
    await expect(page).toHaveTitle(/Gráficas \| /);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Gráficas");
    await loaded(page);
    expect(await boxes(page).count()).toBeGreaterThan(15);
    await expect(page.locator("input[type=checkbox]:checked")).toHaveCount(5);
    await expect(page.locator("svg [data-rider]")).toHaveCount(5);
    expect(problems).toEqual([]);
  });

  test("GRA-E02 Todos y Ninguno cambian la selección, la URL manda al recargar", async ({ page }) => {
    await page.goto(URL_2024);
    await loaded(page);
    const total = await boxes(page).count();

    await page.getByRole("button", { name: "Todos" }).click();
    await expect(page.locator("input[type=checkbox]:checked")).toHaveCount(total);
    await expect(page).toHaveURL(/pilotos=/);
    await page.reload();
    await loaded(page);
    await expect(page.locator("input[type=checkbox]:checked")).toHaveCount(total);

    await page.getByRole("button", { name: "Ninguno" }).click();
    await expect(page.getByText("Selecciona al menos un piloto para ver la gráfica.")).toBeVisible();
    await page.getByRole("button", { name: "Top 5" }).click();
    await expect(page.locator("input[type=checkbox]:checked")).toHaveCount(5);
  });

  test("GRA-E03 cambiar de categoría o temporada reinicia a top 5 y actualiza la URL", async ({ page }) => {
    await page.goto(`${URL_2024}&pilotos=`);
    await expect(page.getByText("Selecciona al menos un piloto")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Moto2" }).click();
    await expect(page).toHaveURL(/categoria=2/);
    await expect(page).not.toHaveURL(/pilotos=/);
    await loaded(page);
    await expect(page.locator("input[type=checkbox]:checked")).toHaveCount(5);

    await page.getByLabel("Temporada").selectOption("2023");
    await expect(page).toHaveURL(/temporada=2023/);
    await loaded(page);
    await expect(page.locator("input[type=checkbox]:checked")).toHaveCount(5);
  });

  test("GRA-E04 tocar o pasar el ratón sobre la gráfica muestra circuito y puntos de cada piloto", async ({ page }) => {
    await page.goto(URL_2024);
    await loaded(page);
    const box = (await chart(page).boundingBox())!;
    await chart(page).click({ position: { x: box.width * 0.5, y: box.height * 0.4 } });
    const tip = page.getByRole("status").filter({ hasText: "pts" });
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("acum.");
    await expect(tip.locator("li")).toHaveCount(5);
    // El tooltip cabe en la pantalla (iPhone incluido).
    const tb = (await tip.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(tb.x).toBeGreaterThanOrEqual(0);
    expect(tb.x + tb.width).toBeLessThanOrEqual(viewport.width + 1);
  });

  test("GRA-E05 alternar Acumulado / Por carrera cambia la URL y el título de la gráfica", async ({ page }) => {
    await page.goto(URL_2024);
    await loaded(page);
    await expect(chart(page)).toHaveAccessibleName(/puntos acumulados/);
    await page.getByRole("button", { name: "Por carrera" }).click();
    await expect(page).toHaveURL(/modo=carrera/);
    await expect(chart(page)).toHaveAccessibleName(/puntos por carrera/);
    await page.getByRole("button", { name: "Acumulado" }).click();
    await expect(chart(page)).toHaveAccessibleName(/puntos acumulados/);
  });

  test("GRA-E06 móvil: sin desbordamiento horizontal con todos los pilotos", async ({ page }) => {
    await page.goto(`${URL_2024}&modo=carrera`);
    await loaded(page);
    await page.getByRole("button", { name: "Todos" }).click();
    await expect(chart(page)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
