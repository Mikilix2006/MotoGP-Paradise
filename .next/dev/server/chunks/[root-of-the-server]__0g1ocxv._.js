module.exports = [
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[project]/src/app/api/next-gp/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$currentGrandPrixService$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/currentGrandPrixService.ts [app-route] (ecmascript)");
;
;
async function GET() {
    try {
        const grandPrix = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$currentGrandPrixService$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getCurrentGrandPrixData"])();
        if (!grandPrix) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "No se encontró ningún Gran Premio actual"
            }, {
                status: 404
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            data: grandPrix
        });
    } catch (error) {
        console.error("Error obteniendo el Gran Premio:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "No se pudo obtener la información del Gran Premio"
        }, {
            status: 500
        });
    }
}
}),
"[project]/src/services/currentGrandPrixService.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getCurrentGrandPrixData",
    ()=>getCurrentGrandPrixData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$seasonService$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/seasonService.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$grandPrixService$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/grandPrixService.ts [app-route] (ecmascript)");
;
;
async function getCurrentGrandPrixData() {
    const currentSeason = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$seasonService$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getCurrentSeason"])();
    if (!currentSeason) {
        throw new Error("No se encontró ninguna temporada marcada como actual");
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$grandPrixService$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getCurrentGrandPrix"])(currentSeason.id);
}
}),
"[project]/src/services/grandPrixService.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getCurrentGrandPrix",
    ()=>getCurrentGrandPrix,
    "getEventsBySeason",
    ()=>getEventsBySeason
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$motogpApi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/motogpApi.ts [app-route] (ecmascript)");
;
async function getEventsBySeason(seasonId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$motogpApi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["motogpFetch"])(`/results/events?seasonUuid=${seasonId}`);
}
async function getCurrentGrandPrix(seasonId) {
    const events = await getEventsBySeason(seasonId);
    return events.find((event)=>event.status === "CURRENT") ?? null;
}
}),
"[project]/src/services/motogpApi.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "motogpFetch",
    ()=>motogpFetch
]);
const MOTOGP_API_URL = "https://api.motogp.pulselive.com/motogp/v1";
async function motogpFetch(endpoint) {
    const response = await fetch(`${MOTOGP_API_URL}${endpoint}`, {
        headers: {
            Accept: "application/json"
        },
        next: {
            revalidate: 60
        }
    });
    if (!response.ok) {
        throw new Error(`MotoGP API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
}),
"[project]/src/services/seasonService.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getCurrentSeason",
    ()=>getCurrentSeason
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$motogpApi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/motogpApi.ts [app-route] (ecmascript)");
;
const SEASONS_ENDPOINT = "/results/seasons";
async function getCurrentSeason() {
    const seasons = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$motogpApi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["motogpFetch"])(SEASONS_ENDPOINT);
    return seasons.find((season)=>season.current === true) ?? null;
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0g1ocxv._.js.map