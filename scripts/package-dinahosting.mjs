/*
 * Empaqueta la app para el hosting Linux de Dinahosting (Passenger).
 *
 *   npm run package:dinahosting      ->  dist/dinahosting/
 *
 * Lo que sube el usuario es EXACTAMENTE el contenido de dist/dinahosting/
 * (sin node_modules: el de Windows no sirve en Linux):
 *   app.js              entrada de Passenger (next en producción, listen(0))
 *   .next/              build de producción (sin caché ni dev)
 *   prisma/             esquema y migraciones
 *   package.json/lock   dependencias de producción (+ prisma, ver abajo)
 *   next.config.mjs     next.config.ts transpilado (el servidor no tiene TypeScript)
 *   sync-sessions.cjs   una pasada del vigilante para cron (sin tsx)
 *   .env.example        plantilla SIN secretos (copia de .env.production.example)
 *   .htaccess.seguridad reglas Apache para denegar .env, prisma/, etc. (se AÑADEN al .htaccess)
 *
 * package.json del paquete: igual que el del repo, pero SIN devDependencies y
 * con `prisma` movido a dependencies, para que `npm ci --omit=dev` pueda
 * ejecutar el postinstall (`prisma generate`) y regenerar el motor Linux.
 * El package.json del repo no se toca. El lock se regenera a partir del actual
 * (mismas versiones).
 *
 * PASOS EN EL SERVIDOR (SSH), desde la raíz de la aplicación (p. ej. www/motogp):
 *   1. Subir el contenido de dist/dinahosting/ (scp/sftp/rsync).
 *   2. Crear ~/.motogp-stats.env (FUERA de www) a partir de .env.example con los
 *      valores reales y `chmod 600`. app.js y el cron lo buscan ahí (o en la ruta
 *      de MOTOGP_ENV_FILE); un .env junto a la app funciona pero está en la zona
 *      pública: avisa. Para prisma: `set -a; . ~/.motogp-stats.env; set +a`.
 *      Añadir .htaccess.seguridad al final del .htaccess (ver su cabecera).
 *   3. npm ci --omit=dev      (necesita internet: descarga el motor Prisma Linux)
 *   4. npx prisma migrate deploy
 *   5. mkdir -p tmp && touch tmp/restart.txt     (Passenger reinicia la app)
 *   Panel: Otras aplicaciones -> Raíz = esa carpeta, Path ejecutable = app.js
 *   Cron: cd <raíz> && node sync-sessions.cjs >> logs/sync.log 2>&1
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "dinahosting");
const require = createRequire(import.meta.url);

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false });

  if (result.status !== 0) {
    throw new Error(`Falló: ${command} ${args.join(" ")}`);
  }
}

function npm(args, cwd = root) {
  /* npm.cmd en Windows exige shell; los argumentos son fijos. */
  const result = spawnSync("npm", args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(`Falló: npm ${args.join(" ")}`);
  }
}

let esbuild;

try {
  esbuild = require("esbuild");
} catch {
  throw new Error(
    "No se encuentra esbuild (hoy llega como dependencia de tsx). Ejecuta `npm install` o añade esbuild como devDependency."
  );
}

console.log("1/6 Build de producción (next build)...");
run(process.execPath, [require.resolve("next/dist/bin/next"), "build"]);

console.log("2/6 Preparando dist/dinahosting...");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const skip = new Set(["cache", "dev", "lock", "trace", "trace-build"]);
const nextDir = path.join(root, ".next");
fs.cpSync(nextDir, path.join(out, ".next"), {
  recursive: true,
  filter: (src) =>
    !skip.has(path.basename(src)) &&
    /* .next/node_modules: ver más abajo. */
    path.relative(nextDir, src) !== "node_modules",
});

/*
 * Turbopack externaliza paquetes (p. ej. @prisma/client) con un alias con hash
 * en .next/node_modules/@prisma/client-<hash>, que es un enlace (junction en
 * Windows) a la ruta ABSOLUTA de este equipo: no sirve en el servidor. Se
 * sustituye por un paquete mínimo (ficheros normales, sin enlaces) que
 * reexporta el paquete real, resuelto desde el node_modules del servidor.
 */
const aliasRoot = path.join(nextDir, "node_modules");

if (fs.existsSync(aliasRoot)) {
  const aliases = [];

  for (const entry of fs.readdirSync(aliasRoot, { withFileTypes: true })) {
    if (entry.name.startsWith("@")) {
      for (const inner of fs.readdirSync(path.join(aliasRoot, entry.name))) {
        aliases.push(`${entry.name}/${inner}`);
      }
    } else {
      aliases.push(entry.name);
    }
  }

  for (const alias of aliases) {
    const real = alias.replace(/-[0-9a-f]{16}$/, "");

    if (real === alias) {
      throw new Error(`Alias de Turbopack inesperado en .next/node_modules: ${alias}`);
    }

    const dir = path.join(out, ".next", "node_modules", alias);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: alias, main: "index.js" }) + "\n"
    );
    fs.writeFileSync(path.join(dir, "index.js"), `module.exports = require("${real}");\n`);
    console.log(`    alias ${alias} -> ${real}`);
  }
}
fs.cpSync(path.join(root, "prisma"), path.join(out, "prisma"), { recursive: true });

if (fs.existsSync(path.join(root, "public"))) {
  fs.cpSync(path.join(root, "public"), path.join(out, "public"), { recursive: true });
}

fs.copyFileSync(path.join(root, "scripts", "dinahosting", "app.js"), path.join(out, "app.js"));
fs.copyFileSync(path.join(root, ".env.production.example"), path.join(out, ".env.example"));
fs.copyFileSync(
  path.join(root, "scripts", "dinahosting", "htaccess.seguridad"),
  path.join(out, ".htaccess.seguridad")
);
fs.mkdirSync(path.join(out, "tmp"), { recursive: true });
fs.mkdirSync(path.join(out, "logs"), { recursive: true });

console.log("3/6 next.config.ts -> next.config.mjs...");
const configSource = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
const { code } = esbuild.transformSync(configSource, { loader: "ts", format: "esm" });
fs.writeFileSync(path.join(out, "next.config.mjs"), code);

console.log("4/6 package.json y lock de producción...");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const prismaVersion = pkg.devDependencies?.prisma ?? pkg.dependencies?.prisma;

if (!prismaVersion) {
  throw new Error("No se encuentra `prisma` en package.json.");
}

const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  private: true,
  engines: { node: ">=20.18" },
  scripts: {
    start: "node app.js",
    postinstall: "prisma generate",
    "db:migrate": "prisma migrate deploy",
    "sync:sessions": "node sync-sessions.cjs",
  },
  dependencies: { ...pkg.dependencies, prisma: prismaVersion },
  allowScripts: pkg.allowScripts,
};
fs.writeFileSync(path.join(out, "package.json"), JSON.stringify(prodPkg, null, 2) + "\n");
fs.copyFileSync(path.join(root, "package-lock.json"), path.join(out, "package-lock.json"));
npm(["install", "--package-lock-only", "--ignore-scripts", "--prefer-offline"], out);

console.log("5/6 Bundle de cron (sync-sessions.cjs)...");
esbuild.buildSync({
  entryPoints: [path.join(root, "scripts", "dinahosting", "sync-cron.ts")],
  outfile: path.join(out, "sync-sessions.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["@prisma/client", ".prisma/client"],
  logLevel: "warning",
});

console.log("6/6 Listo.");
console.log(`
Paquete en: ${out}
Sube TODO su contenido a la raíz de la aplicación en Dinahosting y, por SSH, allí:
  cp .env.example ~/.motogp-stats.env && chmod 600 ~/.motogp-stats.env   # y rellenar valores reales (FUERA de www)
  set -a; . ~/.motogp-stats.env; set +a     # para que prisma vea DATABASE_URL
  npm ci --omit=dev      # requiere internet (motor Prisma Linux)
  npx prisma migrate deploy
  cat .htaccess.seguridad >> .htaccess      # AÑADIR, nunca reemplazar (ver su cabecera)
  mkdir -p tmp && touch tmp/restart.txt
Panel -> Otras aplicaciones: Raíz = esa carpeta; Path ejecutable = app.js
Cron (cada 5 min): cd RAIZ && node sync-sessions.cjs >> logs/sync.log 2>&1
`);
