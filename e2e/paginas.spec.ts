// Recorridos reales (capa E de TESTS.md) en Chromium escritorio y WebKit iPhone,
// contra el build de producción local sobre motogp_test (datos congelados).
// Comprueban comportamiento y textos, sin capturas.
import { expect, test, type Page } from "@playwright/test";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

// GLB-08: ninguna página con errores de consola ni peticiones propias fallidas.
function watchErrors(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === new URL(page.url() || "http://localhost").origin && response.status() >= 500) {
      problems.push(`${response.status()} ${url.pathname}`);
    }
  });
  return problems;
}

test.describe("Global", () => {
  for (const path of ["/", "/calendario", "/resultados", "/graficas", "/aviso-legal"]) {
    test(`GLB-08 ${path} sin errores; GLB-04 pie con aviso legal`, async ({ page }) => {
      const problems = watchErrors(page);
      await page.goto(path);
      // No "networkidle": los prefetch de RSC pueden dejar una conexión abierta.
      // Basta con que ningún bloque siga cargando.
      await expect(page.getByRole("status", { name: /^Cargando/ })).toHaveCount(0, { timeout: 20_000 });
      const footer = page.getByRole("contentinfo");
      await expect(footer).toContainText("No afiliado a MotoGP");
      await expect(footer.getByRole("link", { name: "Aviso legal" })).toHaveAttribute("href", "/aviso-legal");
      expect(problems).toEqual([]);
    });
  }

  test("GLB-01 navegación del menú con enlace activo", async ({ page }) => {
    await page.goto("/");
    if (isMobile(page)) await page.getByRole("button", { name: "Abrir menú" }).click();
    const nav = page.getByRole("navigation", { name: "Menú principal" }).filter({ visible: true });
    await nav.getByRole("link", { name: "Calendario" }).click();
    await expect(page).toHaveURL(/\/calendario$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Calendario");
    if (isMobile(page)) await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(
      page.getByRole("navigation", { name: "Menú principal" }).filter({ visible: true }).getByRole("link", { name: "Calendario" })
    ).toHaveAttribute("aria-current", "page");

    // En móvil el menú sigue abierto tras la comprobación anterior.
    await page
      .getByRole("navigation", { name: "Menú principal" })
      .filter({ visible: true })
      .getByRole("link", { name: "Gráficas" })
      .click();
    await expect(page).toHaveURL(/\/graficas$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Gráficas");
  });

  test("GLB-02 menú móvil: abre, Escape y clic fuera cierran", async ({ page }) => {
    test.skip(!isMobile(page), "solo en móvil");
    await page.goto("/");
    const button = page.getByRole("button", { name: "Abrir menú" });
    await button.click();
    await expect(page.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();

    await button.click();
    await page.locator("main, body").first().click({ position: { x: 10, y: 600 } });
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("GLB-05 tema oscuro se recuerda al recargar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Cambiar a modo oscuro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Cambiar a modo claro" })).toBeVisible();
  });

  test("GLB-06 'Volver arriba' aparece al bajar y sube", async ({ page }) => {
    await page.goto("/calendario");
    await page.getByRole("heading", { name: "Todos los Grandes Premios de la temporada" }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 2000));
    const up = page.getByRole("button", { name: "Volver arriba" });
    await expect(up).toBeVisible();
    await up.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
  });

  test("GLB-07 404 propia", async ({ page }) => {
    const response = await page.goto("/esta-ruta-no-existe");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Te has salido de la trazada" })).toBeVisible();
    await page.getByRole("link", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("PIL-01 /pilotos da 404 en producción", async ({ page }) => {
    const response = await page.goto("/pilotos");
    expect(response?.status()).toBe(404);
  });
});

test.describe("Inicio", () => {
  test("INI-01/05/08/11 los cuatro bloques cargan datos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Próximo Gran Premio").first()).toBeVisible();
    await expect(page.getByText("Cuenta atrás para el Gran Premio")).toBeVisible();
    await expect(page.getByText("Líder", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Clasificación de pilotos" })).toBeVisible();
    await expect(page.getByText(/\d+ pilotos/)).toBeVisible();
    for (const label of ["Cargando próximo Gran Premio", "Cargando estadísticas del campeonato", "Cargando clasificación", "Cargando favoritos"]) {
      await expect(page.getByLabel(label)).toHaveCount(0);
    }
  });

  test("INI-10 pestaña Constructores", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Constructores" }).click();
    await expect(page.getByRole("heading", { name: "Clasificación de constructores" })).toBeVisible();
    await expect(page.getByText(/\d+ equipos|Todavía no hay puntos de constructores/)).toBeVisible();
  });

  test("INI-14 en móvil Favoritos sale antes que la Clasificación", async ({ page }) => {
    test.skip(!isMobile(page), "solo en móvil");
    await page.goto("/");
    const standings = page.getByRole("heading", { name: "Clasificación de pilotos" });
    await standings.waitFor();
    const favorites = page.getByLabel("Cargando favoritos").or(page.getByText(/Favoritos|favoritos/).first());
    const [favBox, standBox] = await Promise.all([favorites.first().boundingBox(), standings.boundingBox()]);
    expect(favBox && standBox && favBox.y < standBox.y).toBe(true);
  });
});

interface ApiSession {
  id: string;
  status: string;
  date_start: string | null;
}
interface ApiEvent {
  name: string;
  sessions: ApiSession[];
}

test.describe("Calendario", () => {
  test("CAL-02/04/05 bloque destacado, acordeón y zona horaria", async ({ page }) => {
    await page.goto("/calendario");
    await page.getByRole("heading", { name: "Todos los Grandes Premios de la temporada" }).waitFor();

    const toggle = page.getByRole("button", { name: /Horarios/ }).first();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/Horarios · Tu hora \(UTC/).first()).toBeVisible();

    const local = page.getByRole("button", { name: "HORA LOCAL" }).first();
    if (await local.isEnabled()) {
      await local.click();
      await expect(local).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText(/Horarios · Hora local del circuito/).first()).toBeVisible();
    }
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  // CAL-10: con el reloj del navegador fijado dentro de un fin de semana real de
  // los datos, nunca hay más de una sesión EN VIVO y la pill sigue a la hora.
  test("CAL-10 como mucho una EN VIVO con el reloj dentro de un GP", async ({ page, request }) => {
    const events = ((await (await request.get("/api/calendar")).json()) as { data: ApiEvent[] }).data;
    const event = events.find((e) => e.sessions.filter((s) => s.date_start).length >= 6);
    test.skip(!event, "no hay un GP con horarios en los datos de prueba");
    const dated = event!.sessions.filter((s) => s.date_start);
    const target = dated[Math.floor(dated.length / 2)];

    // Sesión empezada hace 5 min y aún NOT-STARTED en la base: debe salir EN VIVO.
    await page.route("**/api/calendar", async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { data: ApiEvent[] };
      for (const e of body.data) for (const s of e.sessions) if (e.name === event!.name) s.status = "NOT-STARTED";
      await route.fulfill({ response, json: body });
    });
    await page.clock.setFixedTime(new Date(new Date(target.date_start!).getTime() + 5 * 60_000));
    await page.goto("/calendario");

    const card = page.locator("article", { hasText: event!.name }).last();
    await card.getByRole("button", { name: /Horarios/ }).click();
    await expect(card.getByText("EN VIVO")).toHaveCount(1);
    expect(await card.getByText("Terminada").count()).toBeGreaterThan(0);
  });
});

test.describe("Resultados", () => {
  test("RES-01/02 pestañas y selectores actualizan URL y tabla", async ({ page }) => {
    await page.goto("/resultados");
    await expect(page.getByRole("table", { name: "Clasificación de la sesión" }).or(page.getByText("Esta sesión no tiene resultados publicados todavía."))).toBeVisible();

    const year = page.locator("#res-year");
    const options = await year.locator("option").allTextContents();
    if (options.length > 1) {
      await year.selectOption({ label: options[1] });
      await expect(page).toHaveURL(new RegExp(`year=${options[1]}`));
      await expect(year).toHaveValue(options[1]);
      await page.goBack();
      await expect(year).toHaveValue(options[0]);
    }

    await page.getByRole("button", { name: "Tests" }).click();
    await expect(page).toHaveURL(/section=tests/);
    await page.getByRole("button", { name: "Temporada" }).click();
    await expect(page).not.toHaveURL(/section=tests/);
  });

  test("RES-11 en móvil Año y Sesión van en una fila y Circuito debajo; en escritorio, tres columnas", async ({ page }) => {
    await page.goto("/resultados");
    const [year, event, session] = await Promise.all(
      ["#res-year", "#res-event", "#res-session"].map(async (id) => {
        await page.locator(id).waitFor();
        return (await page.locator(id).boundingBox())!;
      })
    );
    if (isMobile(page)) {
      expect(Math.abs(year.y - session.y)).toBeLessThan(2);
      expect(year.x).toBeLessThan(session.x);
      expect(event.y).toBeGreaterThan(year.y + year.height);
    } else {
      expect(Math.abs(year.y - event.y)).toBeLessThan(2);
      expect(Math.abs(event.y - session.y)).toBeLessThan(2);
      expect(year.x).toBeLessThan(event.x);
      expect(event.x).toBeLessThan(session.x);
    }
  });

  test("RES-04 parámetros inválidos no rompen la página", async ({ page }) => {
    const problems = watchErrors(page);
    await page.goto("/resultados?year=abc&category=zzz&session=XXX");
    await expect(page.getByRole("heading", { name: "Resultados" })).toBeVisible();
    // Next añade un anunciador de rutas con role="alert": solo cuenta la alerta de la página.
    await expect(page.getByRole("alert").filter({ hasText: /No se pudieron|No hay resultados/ })).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});

test.describe("Aviso legal", () => {
  test("LEG-01 título, secciones y correo", async ({ page }) => {
    await page.goto("/aviso-legal");
    await expect(page).toHaveTitle("Aviso legal | Rebufo");
    for (const id of ["que-es", "relacion-con-motogp", "datos", "retirada", "privacidad", "almacenamiento", "creditos"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
  });
});
