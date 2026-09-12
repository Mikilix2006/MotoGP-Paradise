import { prisma } from "../src/lib/prisma";

import {
  syncLiveSessions,
  type LiveSyncResult,
} from "../src/services/importers/liveSessionSync";

/*
 * Vigila el calendario y, cada vez que termina una sesión,
 * importa sus resultados (y lo que dependa de ellos).
 *
 *   npm run watch:sessions           proceso continuo
 *   npm run sync:sessions            una pasada y termina
 *                                    (para cron / Programador de tareas)
 *
 * Entre sesiones duerme hasta el fin previsto de la siguiente;
 * mientras la API no publica una clasificación pregunta cada
 * dos minutos. Ctrl+C para parar.
 */

const ONCE = process.argv.includes("--once");

/* Nunca dormir más de esto: el calendario puede cambiar. */
const MAX_SLEEP_MS = 60 * 60 * 1000;

const MIN_SLEEP_MS = 30 * 1000;

/* Si un ciclo falla (red, API caída), reintentar pasado esto. */
const RETRY_AFTER_ERROR_MS = 5 * 60 * 1000;

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(date);
}

function report(result: LiveSyncResult): void {
  const stamp = formatTime(new Date());

  if (result.activeEvents.length === 0) {
    console.log(`[${stamp}] Sin evento en curso.`);
  } else {
    console.log(
      `[${stamp}] Evento en curso: ${result.activeEvents.join(", ")} · ${result.sessionsRefreshed} sesiones refrescadas`
    );
  }

  for (const label of result.sessionsImported) {
    console.log(`  ✅ Resultados importados: ${label}`);
  }

  for (const label of result.sessionsAwaitingResults) {
    console.log(`  ⏳ Terminada, sin clasificación todavía: ${label}`);
  }

  if (result.postRaceChainExecuted) {
    console.log(
      "  🏁 Carrera importada: estado del evento, estadísticas, campeonato y BMW Award actualizados"
    );
  }

  if (result.nextWakeAt) {
    console.log(
      `  💤 Próxima comprobación: ${formatTime(result.nextWakeAt)} (${result.nextWakeReason})`
    );
  } else {
    console.log(`  💤 ${result.nextWakeReason}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(
    ONCE
      ? "🔄 Sincronización de sesiones (una pasada)..."
      : "👀 Vigilando sesiones. Ctrl+C para parar."
  );

  let stopping = false;

  process.on("SIGINT", () => {
    stopping = true;
    console.log("\nParando...");
  });

  while (!stopping) {
    let delay = RETRY_AFTER_ERROR_MS;

    try {
      const result = await syncLiveSessions();

      report(result);

      if (ONCE) {
        break;
      }

      const wakeIn = result.nextWakeAt
        ? result.nextWakeAt.getTime() - Date.now()
        : MAX_SLEEP_MS;

      delay = Math.min(Math.max(wakeIn, MIN_SLEEP_MS), MAX_SLEEP_MS);
    } catch (error) {
      console.error(`[${formatTime(new Date())}] ❌ Error en la sincronización:`);
      console.error(error);

      if (ONCE) {
        process.exitCode = 1;
        break;
      }
    }

    /*
     * Dormir a trozos para que Ctrl+C responda enseguida.
     */
    const until = Date.now() + delay;

    while (!stopping && Date.now() < until) {
      await sleep(Math.min(MIN_SLEEP_MS, until - Date.now()));
    }
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
