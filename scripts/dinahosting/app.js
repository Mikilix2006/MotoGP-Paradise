/*
 * Punto de entrada para Dinahosting (Passenger). El empaquetador
 * (scripts/package-dinahosting.mjs) lo copia a la raíz del paquete.
 *
 * - Modo Passenger (sin PORT): Passenger asigna el socket, así que se escucha
 *   en el puerto 0, nunca en uno fijo, y sin host.
 *   (En local, 0 elige un puerto aleatorio libre; se muestra en el log.)
 * - Modo proxy (con PORT, p. ej. systemd + Caddy en un VPS): se escucha en
 *   PORT (1-65535) y, si hay HOST, solo en esa dirección (p. ej. 127.0.0.1).
 *   Un PORT inválido aborta el arranque con código 1. En este modo se alargan
 *   los timeouts de inactividad de Node para no cerrar conexiones antes que
 *   el proxy (evita 502 intermitentes).
 * - Las variables de entorno (DATABASE_URL lleva la contraseña de PostgreSQL)
 *   se leen del PRIMER fichero que exista, por este orden. Las variables que
 *   ya existan en el entorno nunca se pisan:
 *     1. la ruta indicada en MOTOGP_ENV_FILE;
 *     2. <home del usuario>/.motogp-stats.env   <- RECOMENDADO: el home queda
 *        FUERA de www, así que Apache no puede servirlo. Dejarlo con chmod 600;
 *     3. .env junto a este fichero: solo por compatibilidad. Esa carpeta es la
 *        zona pública de Apache, así que se emite un aviso por stderr. Si se
 *        usa, hay que protegerlo (ver .htaccess.seguridad).
 *   El log indica la RUTA cargada, nunca el contenido ni los valores.
 * - Los logs van a stdout/stderr (Passenger los recoge en su log de errores).
 *
 * No lo usan ni `npm run dev` ni `npm run start:web` (Railway).
 */
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = __dirname;

function loadEnvFile() {
  const candidates = [];

  if (process.env.MOTOGP_ENV_FILE && !fs.existsSync(process.env.MOTOGP_ENV_FILE)) {
    console.warn("[app] MOTOGP_ENV_FILE apunta a un fichero que no existe: " + process.env.MOTOGP_ENV_FILE);
  }

  if (process.env.MOTOGP_ENV_FILE) {
    candidates.push({ file: process.env.MOTOGP_ENV_FILE, publicZone: false });
  }

  candidates.push({ file: path.join(os.homedir(), ".motogp-stats.env"), publicZone: false });
  candidates.push({ file: path.join(root, ".env"), publicZone: true });

  for (const { file, publicZone } of candidates) {
    if (!fs.existsSync(file)) {
      continue;
    }

    process.loadEnvFile(file);
    console.log("[app] Variables de entorno cargadas desde: " + file);

    if (publicZone) {
      console.error(
        "[app] AVISO DE SEGURIDAD: se ha cargado " + file + ", que está en la zona pública " +
          "(servida por Apache). Muévelo a " + path.join(os.homedir(), ".motogp-stats.env") +
          " con chmod 600 o instala .htaccess.seguridad."
      );
    }

    return;
  }

  console.warn(
    "[app] No se encontró ningún fichero de variables (MOTOGP_ENV_FILE, " +
      path.join(os.homedir(), ".motogp-stats.env") + ", " + path.join(root, ".env") +
      "): se usan solo las variables del entorno."
  );
}

loadEnvFile();

process.env.NODE_ENV = "production";

// Modo de ejecución: con PORT definido (aunque esté vacío o sea inválido) se
// asume proxy inverso; sin PORT, Passenger. Un PORT inválido es un error de
// configuración y se aborta antes de arrancar Next.
const proxyMode = process.env.PORT !== undefined;
let listenPort = 0;
let listenHost;

if (proxyMode) {
  const rawPort = process.env.PORT.trim();
  listenPort = /^\d+$/.test(rawPort) ? Number(rawPort) : NaN;

  if (!Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65535) {
    console.error('[app] PORT inválido: "' + process.env.PORT + '". Debe ser un entero entre 1 y 65535.');
    process.exit(1);
  }

  if (process.env.HOST && process.env.HOST.trim()) {
    listenHost = process.env.HOST.trim();
  }
}

const next = require("next");

// hostname y port solo informan a Next de la dirección en la que corre (la
// guía de servidores personalizados los define como "el host/puerto detrás del
// que corre"); no abren el socket, eso lo hace server.listen más abajo. En
// modo Passenger no hay valor fijo (puerto 0), así que no se pasan.
const app = next(
  proxyMode
    ? { dev: false, dir: root, hostname: listenHost, port: listenPort }
    : { dev: false, dir: root }
);
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      Promise.resolve(handle(req, res)).catch((error) => {
        console.error("[app] Error atendiendo " + req.method + " " + req.url + ":", error);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Error interno del servidor");
        } else {
          res.end();
        }
      });
    });

    if (proxyMode) {
      // Caddy cierra por inactividad a los 2 min (idle_timeout 2m por defecto).
      // Node debe cerrar DESPUÉS que el proxy: si no, reutilizaría una conexión
      // que Node ya cerró y el proxy respondería 502. 125 s = 120 s + margen.
      server.keepAliveTimeout = 125000;
      // Node exige headersTimeout > keepAliveTimeout (si no, puede cortar
      // conexiones inactivas por el temporizador de cabeceras) y además
      // <= requestTimeout (300 s por defecto), que se cumple con 126 s.
      server.headersTimeout = 126000;
    }

    const onListening = () => {
      const address = server.address();
      const where =
        typeof address === "string" ? "socket " + address : address.address + ":" + address.port;
      const mode = proxyMode
        ? "modo proxy (PORT=" + process.env.PORT.trim() + (listenHost ? ", HOST=" + listenHost : ", sin HOST") +
          ", keepAliveTimeout=" + server.keepAliveTimeout + " ms, headersTimeout=" + server.headersTimeout + " ms)"
        : "modo Passenger (puerto aleatorio)";
      console.log("[app] MotoGP Stats en producción escuchando en " + where + " - " + mode);
    };

    server.on("error", (error) => {
      console.error("[app] Error del servidor HTTP:", error);
      process.exit(1);
    });

    if (listenHost) {
      server.listen(listenPort, listenHost, onListening);
    } else {
      server.listen(listenPort, onListening);
    }

    const shutdown = () => server.close(() => process.exit(0));
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  })
  .catch((error) => {
    console.error("[app] No se pudo arrancar Next.js:", error);
    process.exit(1);
  });
