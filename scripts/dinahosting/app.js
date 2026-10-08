/*
 * Punto de entrada para Dinahosting (Passenger). El empaquetador
 * (scripts/package-dinahosting.mjs) lo copia a la raíz del paquete.
 *
 * - Passenger asigna el socket: se escucha en el puerto 0, nunca en uno fijo.
 *   (En local, 0 elige un puerto aleatorio libre; se muestra en el log.)
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

const next = require("next");

const app = next({ dev: false, dir: root });
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

    server.listen(0, () => {
      const address = server.address();
      const where = typeof address === "string" ? "socket " + address : "puerto " + address.port;
      console.log("[app] MotoGP Stats en producción escuchando en " + where);
    });

    const shutdown = () => server.close(() => process.exit(0));
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  })
  .catch((error) => {
    console.error("[app] No se pudo arrancar Next.js:", error);
    process.exit(1);
  });
