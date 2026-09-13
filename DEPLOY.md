# Desplegar en Railway

La app necesita **dos servicios** compartiendo la misma base de datos:

- **web** — el sitio Next.js (`npm run start:web`).
- **worker** — el vigilante de sesiones (`npm run watch:sessions`), el equivalente en Linux a la tarea programada de Windows que corre en local. Tiene que vivir 24/7; si se cae, Railway lo reinicia solo.

## 1. Crear el proyecto

1. En [railway.app](https://railway.app), **New Project → Deploy from GitHub repo** y elige este repositorio (súbelo a GitHub si aún no está).
2. Railway detecta Next.js automáticamente (Nixpacks) y crea un primer servicio. Ese será **web**.

## 2. Añadir PostgreSQL

**+ New → Database → PostgreSQL** dentro del mismo proyecto. Railway crea la variable `DATABASE_URL` automáticamente en ese servicio de base de datos — hay que referenciarla desde los otros dos (paso 4).

## 3. Configurar el servicio **web**

En el servicio que Railway creó del repo:

- **Settings → Deploy**
  - Build Command: (déjalo vacío, usa `npm run build` por defecto)
  - Start Command: `npm run start:web`
- **Variables** (Settings → Variables): añade
  ```
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  MOTOGP_API_URL=https://api.motogp.pulselive.com/motogp/v1
  MOTOGP_RESULTS_API_URL=https://api.motogp.pulselive.com/motogp/v1/results
  ```
  La sintaxis `${{Postgres.DATABASE_URL}}` referencia la variable del servicio de base de datos por su nombre (ajusta `Postgres` al nombre real que le haya puesto Railway, visible en la pestaña del servicio).
- **Settings → Networking → Generate Domain** para obtener la URL pública (`https://tuapp.up.railway.app`).

`start:web` ejecuta `prisma migrate deploy` antes de `next start`, así que las migraciones se aplican solas en cada despliegue — no hace falta correrlas a mano.

## 4. Añadir el servicio **worker**

**+ New → Empty Service** (o "GitHub Repo" otra vez apuntando al mismo repo).

- **Settings → Deploy**
  - Start Command: `npm run watch:sessions`
- **Variables**: las mismas tres que en *web*, con el mismo `${{Postgres.DATABASE_URL}}`.
- No necesita dominio público (no sirve peticiones HTTP).

## 5. Primera carga de datos

La base de datos nueva está vacía. Desde tu máquina, con `DATABASE_URL` apuntando a la de Railway (cópiala de **Postgres → Variables → DATABASE_URL**, usa la que empieza por `postgresql://` con el host público, no el interno `*.railway.internal`):

```bash
# en tu .env local, temporalmente:
DATABASE_URL="postgresql://...la de Railway..."

npx prisma migrate deploy
npm run import:seasons
npm run import:events
npm run import:event-categories
npm run import:sessions
npm run import:event-details -- 2026
npm run import:session-results -- 2026
npm run import:riders -- 2026
npm run import:rider-statistics -- 2026
npm run import:championship-standings -- 2026
npm run import:bmw-award -- 2026
npm run fix:duplicate-riders
```

(Repite `event-details`/`session-results`/`riders`/`rider-statistics`/`championship-standings`/`bmw-award` para años anteriores si quieres histórico completo — sin `-- <año>` recorren todo, tarda horas). Ver [import-guardian](.claude/agents/import-guardian.md) para el pipeline completo.

A partir de ahí, el **worker** mantiene la temporada al día solo.

## Coste orientativo

Railway cobra por uso (no por servicio fijo). Un sitio Next.js de tráfico bajo/medio + un worker ligero (duerme la mayor parte del tiempo) + Postgres pequeño suelen entrar en el plan Hobby ($5/mes de crédito incluido; el excedente se paga por uso, normalmente unos pocos dólares más al mes para esta carga).

## Variables de entorno — resumen

| Variable | Dónde | Valor |
|---|---|---|
| `DATABASE_URL` | web + worker | `${{Postgres.DATABASE_URL}}` |
| `MOTOGP_API_URL` | web + worker | `https://api.motogp.pulselive.com/motogp/v1` |
| `MOTOGP_RESULTS_API_URL` | web + worker | `https://api.motogp.pulselive.com/motogp/v1/results` |
