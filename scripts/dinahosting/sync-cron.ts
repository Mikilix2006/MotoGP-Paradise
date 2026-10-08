/*
 * Entrada del bundle `sync-sessions.cjs` (ver scripts/package-dinahosting.mjs)
 * para ejecutarlo desde cron en Dinahosting: UNA pasada del vigilante de
 * sesiones, sin tsx.
 *
 *  - Variables de entorno (DATABASE_URL lleva la contraseña de PostgreSQL):
 *    se usa el PRIMER fichero que exista, sin pisar variables ya definidas:
 *      1. la ruta de MOTOGP_ENV_FILE;
 *      2. <home>/.motogp-stats.env  (RECOMENDADO: fuera de www; chmod 600);
 *      3. .env junto al bundle o en el directorio actual (zona pública de
 *         Apache: se avisa por stderr; ver .htaccess.seguridad).
 *    Se registra la RUTA cargada, nunca su contenido.
 *  - Bloqueo con fichero tmp/sync-sessions.lock: si otra pasada sigue viva,
 *    esta termina sin hacer nada (código 0). Un bloqueo de un proceso muerto
 *    o de más de 30 min se considera obsoleto y se retoma.
 *  - Tope de 20 min por pasada: si la API se cuelga, el proceso se aborta
 *    (código 2) y libera el bloqueo.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = __dirname;
const LOCK_FILE = path.join(ROOT, "tmp", "sync-sessions.lock");
const STALE_MS = 30 * 60 * 1000;
const MAX_RUN_MS = 20 * 60 * 1000;

function loadEnv(): void {
  const homeFile = path.join(os.homedir(), ".motogp-stats.env");
  const candidates: { file: string; publicZone: boolean }[] = [];

  if (process.env.MOTOGP_ENV_FILE && !fs.existsSync(process.env.MOTOGP_ENV_FILE)) {
    console.warn(`MOTOGP_ENV_FILE apunta a un fichero que no existe: ${process.env.MOTOGP_ENV_FILE}`);
  }

  if (process.env.MOTOGP_ENV_FILE) {
    candidates.push({ file: process.env.MOTOGP_ENV_FILE, publicZone: false });
  }

  candidates.push({ file: homeFile, publicZone: false });

  for (const dir of [ROOT, process.cwd()]) {
    candidates.push({ file: path.join(dir, ".env"), publicZone: true });
  }

  for (const { file, publicZone } of candidates) {
    if (!fs.existsSync(file)) {
      continue;
    }

    process.loadEnvFile(file);
    console.log(`[${new Date().toISOString()}] Variables de entorno cargadas desde: ${file}`);

    if (publicZone) {
      console.error(
        `AVISO DE SEGURIDAD: se ha cargado ${file}, que está en la zona pública (servida por Apache). ` +
          `Muévelo a ${homeFile} con chmod 600 o instala .htaccess.seguridad.`
      );
    }

    return;
  }

  console.warn(
    `[${new Date().toISOString()}] No se encontró ningún fichero de variables ` +
      `(MOTOGP_ENV_FILE, ${homeFile}, .env): se usan solo las variables del entorno.`
  );
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function tryCreateLock(): boolean {
  try {
    const fd = fs.openSync(LOCK_FILE, "wx");
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

function acquireLock(): boolean {
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });

  if (tryCreateLock()) {
    return true;
  }

  let holderAlive = false;

  try {
    const pid = Number.parseInt(fs.readFileSync(LOCK_FILE, "utf8"), 10);
    const age = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
    holderAlive = Number.isInteger(pid) && isAlive(pid) && age < STALE_MS;
  } catch {
    /* El bloqueo desapareció entre medias: se reintenta abajo. */
  }

  if (holderAlive) {
    return false;
  }

  fs.rmSync(LOCK_FILE, { force: true });
  return tryCreateLock();
}

function releaseLock(): void {
  try {
    const pid = Number.parseInt(fs.readFileSync(LOCK_FILE, "utf8"), 10);

    if (pid === process.pid) {
      fs.rmSync(LOCK_FILE, { force: true });
    }
  } catch {
    /* Ya no existe. */
  }
}

async function run(): Promise<void> {
  loadEnv();

  if (!acquireLock()) {
    console.log(
      `[${new Date().toISOString()}] Pasada anterior todavía en curso: se omite esta.`
    );
    return;
  }

  process.on("exit", releaseLock);
  process.on("SIGTERM", () => process.exit(143));
  process.on("SIGHUP", () => process.exit(129));

  setTimeout(() => {
    console.error(
      `[${new Date().toISOString()}] La pasada superó ${MAX_RUN_MS / 60000} min: se aborta.`
    );
    process.exit(2);
  }, MAX_RUN_MS).unref();

  /*
   * Import dinámico: el vigilante (y Prisma, y las URLs de las APIs que se
   * leen al cargar el módulo) se inicializan DESPUÉS de cargar .env y de
   * tomar el bloqueo. watch-sessions.ts arranca solo al importarse.
   */
  process.argv.push("--once");
  await import("../watch-sessions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
