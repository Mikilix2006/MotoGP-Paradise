# Plan de tests

Objetivo: no se despliega nada que no pase todos los tests. Cubre toda la web
(6 páginas, 9 endpoints, cabecera, pie y 404). Se comprueban **comportamiento y
textos**, no capturas de pantalla.

## Capas

| Capa | Herramienta | Datos | Dónde corre |
|---|---|---|---|
| **U**: lógica pura | Vitest | Fixtures pequeños escritos a mano (`src/**/__fixtures__/`) | Local, `desplegar.ps1`, CI en cada PR |
| **C**: componentes | Vitest + Testing Library (jsdom), `fetch` simulado | Los mismos fixtures | Local, `desplegar.ps1`, CI |
| **E**: recorrido real | Playwright, Chromium escritorio + WebKit iPhone | Base `motogp_test` cargada desde `motogp-datos.sql.gz`, reloj fijado con `page.clock` | Local y `desplegar.ps1` (no en CI: el volcado no se sube) |
| **A**: endpoints | Vitest (`tests/api/`), solo lectura, por reglas | La base contra la que esté la URL (`BASE_URL`) | Local antes de desplegar, producción tras desplegar y cada hora (GitHub Actions) |

Scripts npm previstos: `test` (U+C), `test:e2e` (E), `test:api` (A, con
`BASE_URL`), `test:all` (lint + `tsc` + todo lo anterior en local).

- **`desplegar.ps1`**: ejecuta `npm run test:all` antes de empaquetar y aborta
  si falla. Al terminar, `test:api` contra `http://rebufo.planetamiguel.com`.
- **GitHub Actions `pr.yml`**: lint, `tsc` y `npm test` en cada PR.
- **GitHub Actions `salud.yml`**: `test:api` contra producción cada hora. Si
  falla, GitHub avisa por correo. Si CI no llega al dominio, se cambia por un
  timer de systemd en el VPS.
- **Fallos que salgan**: una rama `fix/` y un commit por fallo, con su test. Se
  despliega cuando todo está en verde.

Antes de escribir tests: mover la lógica pura de los componentes y
repositorios a módulos `*Model.ts` (sin cambiar el comportamiento), configurar
Vitest (alias `@/`, jsdom) y Playwright, e instalar eslint con
`eslint-config-next`.

## Fixtures (uno por trampa conocida)

| Fixture | Reproduce |
|---|---|
| `qatar-provisional` | Calendario provisional: sesiones fuera de las fechas del evento y fin anterior al inicio |
| `duracion-cero` | Sprint y carreras con fin == inicio |
| `watcher-atrasado` | Varias sesiones empezadas sin `FINISHED` |
| `carrera-reiniciada` | Duplicado fantasma de RAC junto a RAC2 |
| `sin-fecha` | Sesiones sin `date_start` (con y sin `weekday`) |
| `gpday-jpn-aus` | `gpDay` que no encaja con el horario (no debe corregirse) |
| `cambio-horario` | Fin de semana con cambio de hora; sesión del viernes que en "tu hora" cae en jueves |
| `zona-invalida` | Evento sin `time_zone` válida |
| `empates` | Pilotos y constructores empatados a puntos |
| `posicion-nula` | Piloto sin `championshipPosition` |
| `cancelado-o-atascado` | GP cancelado (AUS 2026) y evento que se queda `CURRENT` tras la carrera |
| `500cc` | Categoría 500cc en resultados y totales de clase reina |
| `tests-pretemporada` | Sesiones de test sin tiempo ni mejor vuelta |
| `textos-raros` | Biografía con UTF-8 doble codificado, entidades HTML y etiquetas |

## Casos

### Global: cabecera, pie, tema, 404

| ID | Comprueba | Capa |
|---|---|---|
| GLB-01 | Menú: Inicio, Calendario, Resultados, Gráficas, Predicciones; el enlace activo lleva `aria-current="page"` en cada página; "Predicciones" (`#`) nunca activo; «Gráficas» lleva a `/graficas` | U (`isActive`, enlaces de `Header`) + E |
| GLB-02 | Menú móvil: abre/cierra con el botón ("Abrir menú"/"Cerrar menú", `aria-expanded`), se cierra con Escape (vuelve el foco al botón), clic fuera, clic en un enlace y al pasar a ≥768 px | E (WebKit iPhone) |
| GLB-03 | Logo "REBUFO" lleva a `/` | E |
| GLB-04 | Pie: texto "No afiliado a MotoGP" y enlace "Aviso legal" → `/aviso-legal` en todas las páginas | E |
| GLB-05 | Tema: claro por defecto; el botón cambia a oscuro, la etiqueta cambia y se recuerda al recargar; sin `localStorage` no rompe | C + E |
| GLB-06 | "Volver arriba" aparece tras bajar 300 px y sube | E |
| GLB-07 | Ruta inexistente: 404 con "Te has salido de la trazada" y "Volver al inicio" → `/` | E |
| GLB-08 | Ninguna página tiene errores en consola ni peticiones fallidas (salvo los 404 esperados) | E |

### Inicio `/`

| ID | Comprueba | Capa |
|---|---|---|
| INI-01 | Próximo GP: nombre, "RONDA n" (o `short_name` sin ronda, sin repetirlo dos veces), estado ("En curso"/"Próximamente"/"Finalizado"), circuito, lugar y país, fechas, bandera | C + E |
| INI-02 | Próximo GP con `date_start` vacío no rompe la página (hoy `formatDate("")` lanza RangeError: sospecha) | U + C |
| INI-03 | Próximo GP: carga ("Cargando próximo Gran Premio") y error con 404 o 500 ("No se ha podido cargar la información del próximo GP") | C |
| INI-04 | Cuenta atrás: dígitos a dos cifras, baja cada segundo, se queda en 00 al llegar (sin negativos), etiquetas cortas en móvil | U (`calculateTimeRemaining`) + C + E |
| INI-05 | Estadísticas: líder = más puntos (con empate, el orden de la API), "#n · equipo", puntos; datos del circuito con "—" si faltan; sin imagen del circuito en producción | C + E |
| INI-06 | Sprint: "Día de la Sprint" y "Hora peninsular" no contradicen el día cerca de medianoche (hoy usan zonas distintas: sospecha) | U |
| INI-07 | Estadísticas: si falla cualquiera de los dos endpoints o no hay pilotos, sale el error "No se pudieron cargar las estadísticas del campeonato" | C |
| INI-08 | Clasificación pilotos: orden por puntos, posición a dos cifras, podio en los 3 primeros, colores oro/plata/bronce, "{n} pilotos", bandera solo con ISO | C + E |
| INI-09 | Piloto sin posición no se muestra como "00" con estilo de podio (sospecha) | C |
| INI-10 | Pestaña Constructores: se carga solo al abrirla y una vez; empate resuelto por victorias y poles; "{n} equipos"; vacío "Todavía no hay puntos de constructores esta temporada."; tras un error, ¿se puede reintentar? (hoy no: sospecha) | C + E |
| INI-11 | Favoritos: 5 filas, botón "Ver toda la parrilla (n)" / "Ver solo los favoritos" solo con más de 5; solo una fila abierta a la vez | C + E |
| INI-12 | Favoritos, detalle: barras de los 5 factores; texto "Sin carreras de MotoGP aquí…" si no hay historial; pills de historial ("S" en sprint, "DNF"); bloque de moto solo con constructor; "va a más"/"va a menos" | C |
| INI-13 | Favoritos: 404 → error; 200 con `[]` → "Todavía no hay datos suficientes para este GP." | C |
| INI-14 | En móvil, Favoritos sale antes que la Clasificación | E (WebKit iPhone) |

### Calendario `/calendario`

| ID | Comprueba | Capa |
|---|---|---|
| CAL-01 | Carga, error ("No se ha podido cargar el calendario") y vacío ("No hay Grandes Premios disponibles") | C |
| CAL-02 | Bloque "Próximo Gran Premio" con el evento `is_next_gp`, repetido en la lista; sin `is_next_gp` no sale el bloque | C + E |
| CAL-03 | Tarjeta: ronda, estado ("Finalizado"/"En curso"/"Próximamente"; desconocido → "Próximamente"), nombre, circuito, fechas, bandera | U (`getStatusBadge`) + C |
| CAL-04 | Acordeón: solo con sesiones; abre y cierra con `aria-expanded`; cada tarjeta independiente; la copia destacada y la de la lista no comparten ids | C + E |
| CAL-05 | "TU HORA" / "HORA LOCAL": compartido entre tarjetas; "HORA LOCAL" deshabilitado con zona inválida y con su `title`; etiqueta "(UTC±h[:mm])" correcta (incluye +5:30 y cambio de hora) | U (`getOffsetLabel`, `validZone`) + C + E |
| CAL-06 | Columnas por día en la zona mostrada, ordenadas por fecha; sesión del viernes que en tu hora cae el jueves; sin fecha → "—" en su día local; sin fecha ni día → no sale; máximo 4 columnas | U (`getScheduleColumns`) |
| CAL-07 | Horas `HH:mm` en 24 h y "—" si no hay fecha | U (`formatSessionTime`) |
| CAL-08 | Nombres: FP1, FP2, Práctica, Q1, Q2, Sprint, Warm Up, Carrera; Sprint y Carrera en rojo | U + C |
| CAL-09 | Pills: como mucho una "EN VIVO" en todo momento; las anteriores "Terminada"; `FINISHED` manda; fin anterior al inicio no termina; sprint y carrera con fin == inicio no terminan al empezar; sin fecha ni pill | U (`sessionState`, hecho) |
| CAL-10 | Pills en la página real con el reloj fijado en Qatar 2026 (viernes, sábado mañana, durante el sprint, domingo noche) en Chromium y WebKit | E |
| CAL-11 | Las pills cambian solas al pasar el minuto, sin recargar | C (temporizadores falsos) |
| CAL-12 | Calendario provisional corregido: sesiones dentro del fin de semana, día del horario real, misma hora; JPN/AUS sin corregir; duplicado fantasma descartado; orden por instante con desempate Moto3, Moto2, MotoGP | U (`findProvisionalCorrector`, `toCalendarSessions`, `isGhostDuplicate`) |
| CAL-13 | Hora de pared del circuito a instante absoluto en días de cambio de hora | U (`wallClockToInstant`, `toAbsoluteIso`) |

### Resultados `/resultados`

| ID | Comprueba | Capa |
|---|---|---|
| RES-01 | Pestañas "Temporada"/"Tests": la URL cambia (`section=tests` solo en tests); pulsar la activa no hace nada | C + E |
| RES-02 | Selectores Año, Circuito, Sesión y Categoría: cada cambio actualiza la URL y la tabla; los selectores reflejan lo que hay en la URL; atrás/adelante del navegador funcionan | E |
| RES-03 | Cascada de selección: evento → categoría → sesión, con sus valores por defecto (MotoGP, última sesión) | U (`resolveSelection`) |
| RES-04 | Parámetros inválidos en la URL (año raro, categoría rara) caen al valor por defecto sin error | U + E |
| RES-05 | Tabla de carrera: "Tiempo" y "Pts."; P1 con tiempo, el resto "+gap" o estado; puntos con decimales; no clasificados al final por vueltas | U (`formatRow`, `sortRows`) + C |
| RES-06 | Tabla no de carrera: "Mejor vuelta" y "Dif."; en tests sin mejor vuelta la columna se oculta | U + C |
| RES-07 | Etiquetas de sesión (RAC2 → "Carrera", igual que en el calendario; Qn/FPn) y categoría (500cc hasta 2001, sin ™); nombres de evento en mayúsculas pasan a título; nombre del evento delante solo si el circuito tiene varios | U |
| RES-08 | Sin filas: "Esta sesión no tiene resultados publicados todavía." | C + E |
| RES-09 | Error: mensaje de la API, "Reintentar" vuelve a pedir y se recupera | C |
| RES-10 | Cambiar rápido de selección no deja ver resultados de una selección anterior | C |

### Pilotos `/pilotos`

| ID | Comprueba | Capa |
|---|---|---|
| PIL-01 | En producción da 404 | A + E (build de producción) |
| PIL-02 | En desarrollo: categoría por defecto MotoGP, cambio a Moto2/Moto3 vuelve al primer piloto | C |
| PIL-03 | Carrusel: flechas, teclas ←/→ (no con modificadores), circular, contador "N / total", flechas deshabilitadas con un solo piloto | C |
| PIL-04 | Tarjeta: imagen o "Imagen del piloto no disponible", "Sin equipo", color de equipo casi negro ignorado, edad en el día del cumpleaños, biografía larga con "Leer más"/"Leer menos" | U (`visibleTeamColor`, `ageFrom`) + C |
| PIL-05 | Ficha: pestañas con flechas/Inicio/Fin; vacíos de temporada, títulos y trayectoria; "En MotoGP" y "Clase reina" solo cuando procede; plural "título/títulos" | U (`groupTrajectory`, `plural`, `categoryRank`) + C |
| PIL-06 | Trayectoria: no junta temporadas no consecutivas con los mismos datos (hoy sí: sospecha) | U |
| PIL-07 | Biografías: doble codificación, entidades y etiquetas a texto plano | U (`htmlToPlainText`) |

### Aviso legal `/aviso-legal`

| ID | Comprueba | Capa |
|---|---|---|
| LEG-01 | Título "Aviso legal \| Rebufo", fecha de actualización, las 7 secciones con sus anclas, enlace `mailto:` con el correo | E |

### Cuentas de usuario (apagadas por defecto)

Las cuentas dependen del interruptor `REGISTRO_ABIERTO`, **apagado** en el entorno de tests (variable sin definir). Los E2E y los endpoints comprueban solo el estado apagado; el comportamiento con el interruptor encendido se cubre con tests unitarios, de rutas y de componentes (con la base y Better Auth simulados).

| ID | Comprueba | Capa |
|---|---|---|
| CUE-01 | `/acceso`, `/registro`, `/recuperar`, `/perfil`, `/privacidad` y `/condiciones` dan 404 con las cuentas apagadas (`e2e/paginas.spec.ts`, «Cuentas apagadas») | E |
| CUE-02 | El botón de perfil del header es un marcador «Perfil (próximamente)» (`aria-disabled`), no un enlace, y no hay errores de consola | E |
| CUE-03 | `/aviso-legal` sigue diciendo que no se usan cookies (`#almacenamiento`) | E |
| CUE-A | `GET /api/cuenta/estado` responde 200 `{ data: { abierto: false, usuario: null } }`; `/api/auth/get-session`, `/api/auth/sign-in/email`, `PUT /api/cuenta/color` y `POST /api/cuenta/eliminar` dan 404 (`tests/api/endpoints.spec.ts`) | A |
| CUE-U | Color de acento (`src/lib/accent.test.ts`): `parseHex`/`toHex`; `deriveAccent` cumple el contraste AA en claro y oscuro y conserva el tono; el script del `<head>` produce el mismo CSS que `accentCss`, ignora una cookie manipulada y `applyAccent` pinta, recuerda y se deshace. Correo (`src/lib/mail.test.ts`): sin SMTP en desarrollo sale por consola, en producción falla, con SMTP usa servidor, puerto y remitente configurados | U |
| CUE-R | Rutas (`src/app/api/cuenta/cuenta.test.ts`, `better-auth` y Prisma simulados): interruptor apagado o sin definir da 404 sin tocar nada; `/api/cuenta/estado` sin y con sesión (sin datos internos) y con la lectura de sesión fallando; `PUT/DELETE /api/cuenta/color` (valida `#rrggbb`, 401 sin sesión, 403 desde otro origen); `POST /api/cuenta/eliminar` (contraseña, código TOTP o de recuperación con 2FA, mensaje genérico, 403 desde otro origen) | C |
| CUE-C | Componentes (`src/components/cuenta/cuenta.test.tsx`, `fetch` y cliente de auth simulados): `traducirError`; `FormRegistro` (exige aceptar las condiciones, alias como usuario, error de alias ocupado); `FormAcceso` (error y reenvío de verificación, 2FA, entrada directa); `PerfilBoton` (cerrado, abierto sin sesión, con sesión, consulta fallida); `PerfilTabs` (5 pestañas, flechas, el código 2FA al eliminar solo con 2FA) | C |

**Deuda: no hay E2E automático del flujo completo con el interruptor encendido** (registro, verificación del correo, inicio de sesión, recuperar contraseña, 2FA, borrado de cuenta y límite de intentos). Exigiría escribir en `motogp_test` y capturar los correos. Se verificó una vez a mano, contra la base local, con un test de integración temporal (registro → verificación → inicio de sesión, recuperar contraseña, 2FA, borrado y 429 por límite de intentos) que se borró después; no es un test permanente. Tampoco se ha visto el login en pantalla (tema claro, oscuro y móvil) ni probado en producción.

### Endpoints (capa A, reglas para cada respuesta)

Comunes: `200` con `{ data }`, errores con `{ error }` en español, nunca un 500.
Métodos no previstos → 405.

| ID | Endpoint | Reglas |
|---|---|---|
| API-01 | `GET /api/calendar` | Forma completa de evento y sesión; fechas válidas; `date_end` null o mayor que `date_start`; estados conocidos (`FINISHED`, `CURRENT`, `NOT-STARTED` y los de sesión); como mucho un evento `CURRENT` y un `is_next_gp`; sesiones dentro del fin de semana del evento; ordenadas por instante; solo categorías 1/2/3; sin eventos de test; rondas crecientes |
| API-02 | `GET /api/next-gp` | 200 o 404; forma; `nextMotoGPRace` en el futuro o dentro del fin de semana; coincide con el `is_next_gp` del calendario (id y ronda) |
| API-03 | `GET /api/next-gp/favorites` | 200 o 404; puntuaciones 0–100; probabilidades suman ≈100; rangos 1..n sin huecos; historial ≤8; mismo evento que `next-gp` |
| API-04 | `GET /api/riders/standings` | Forma; ordenada por puntos; sin pilotos repetidos; puntos ≥0 |
| API-05 | `GET /api/constructors/standings` | Forma; ordenada; posiciones 1..n únicas |
| API-06 | `GET /api/results` (varias combinaciones) | 200 o 404; selección resuelta coherente con las opciones; filas ordenadas; parámetros inválidos no dan 400 ni 500 |
| API-07 | `GET /api/riders/carousel` | En producción, 404. En local: 400 con categoría inválida; `image_url` null o `https://photos.motogp.com/` |
| API-08 | `POST /api/dev/image-issue` | En producción, 404. En local solo las respuestas 400 (escribe en `logs/`, no entra en el barrido de solo lectura) |
| API-09 | Páginas | `/`, `/calendario`, `/resultados`, `/aviso-legal` dan 200; `/pilotos` y una ruta inventada dan 404 en producción |

### Gráfica de puntos `/graficas` (capa de datos)

Lógica en `src/services/stats/pointsProgressModel.ts`, repositorio `pointsProgressRepository.ts` y endpoint `GET /api/riders/points-progress?year=&category=`. Fixtures en `src/services/stats/__fixtures__/pointsProgress.ts`.

| ID | Comprueba | Capa |
|---|---|---|
| GRA-U01 | Eventos ordenados por `sequence` y con abreviatura, circuito y país | U (`buildPointsProgress`) |
| GRA-U02 | Sprint + carrera con desglose y acumulado; el último acumulado cuadra con la clasificación | U |
| GRA-U03 | Piloto sin fila en un GP: puntos `null` (nunca 0), acumulado plano y `null` antes de su primera participación; un paso por evento | U |
| GRA-U04 | Carrera reiniciada (RAC sin puntos + RAC2; dos sesiones con suma completa; shortname nulo): cuenta una sola, la más tardía que puntúa | U |
| GRA-U05 | Se excluyen GP cancelados, de test y sin resultados; carrera cancelada con sprint disputada cuenta por la sprint | U |
| GRA-U06 | Sesiones antiguas `type='SESSION'`: solo RAC*/SPR* por shortname | U (`classifySession`) |
| GRA-U07 | El sustituto no aparece aunque puntúe | U (`selectRoster`) |
| GRA-U08 | `type` nulo: respaldo con los pilotos de `ChampionshipStanding` | U |
| GRA-U09 | Empates: orden por posición final de la clasificación; sin posición, al final y sin NaN | U |
| GRA-A01 | Forma: un paso por evento, eventos ordenados, pilotos sin repetir y por posición final; `points` null implica acumulado plano; acumulado = anterior + puntos | A |
| GRA-A02 | `year`/`category` inválidos dan 400 con `{ error }` | A |
| GRA-A03 | Temporada cerrada (2024 MotoGP): último acumulado = `ChampionshipStanding.points` | A |
| GRA-A04 | POST da 405 | A |
| GRA-U10 | Escalas y ejes: `linearScale`, `niceTicks` (1/2/5 × 10^k), `labelStep`, `nearestIndex`, `eventLabel` | U (`chartModel`) |
| GRA-U11 | Trazado con huecos: `null` corta la línea y no se dibuja como 0; acumulado vs por carrera | U |
| GRA-U12 | URL `?temporada=&categoria=&modo=&pilotos=`: defectos, valores inválidos, ida y vuelta, `pilotos=` vacío = ninguno, dorsal repetido usa id | U |
| GRA-U13 | Colores por marca/equipo: base de marca, satélites con otro tono y luminosidad (distancia RGB mínima entre equipos, contraste mínimo en claro y oscuro, marca con muchos equipos), compañeros mismo color con trazo/marcador distintos, sin colores repetidos entre equipos, contraste en claro y oscuro, estable ante el orden | U (`riderColorsModel`) |
| GRA-U14 | Respaldo sin marca: `Team.color` ajustado (`visibleTeamColor`) o paleta fija sin repetir; piloto sin equipo | U |
| GRA-C01 | Carga: pide año y categoría, top 5 marcado, lista única leyenda+selector con 7 casillas; estado «Cargando gráfica» | C |
| GRA-C02 | La URL manda sobre el top 5 (dorsales) y las fichas desconocidas se ignoran | C |
| GRA-C03 | Top 5 / Todos / Ninguno y casillas escriben la selección en la URL | C |
| GRA-C04 | Cambiar categoría o temporada reinicia a top 5 | C |
| GRA-C05 | Por carrera: el GP sin participación es hueco (línea cortada, sin punto) | C |
| GRA-C06 | Acumulado: línea continua con punto en cada GP | C |
| GRA-C07 | Teclado en la gráfica: circuito, desglose sprint/carrera, acumulado y «no participó» | C |
| GRA-C08 | Sin pilotos seleccionados: mensaje en lugar de gráfica | C |
| GRA-C09 | Error en español fijo (no el crudo) con «Reintentar» que se recupera | C |
| GRA-C10 | Vacío: 404 o respuesta sin GP | C |
| GRA-C11 | Respuesta 200 sin `data`: mensaje de error fijo | C |
| GRA-E01 | `/graficas` (2024 MotoGP): título, top 5, lista leyenda+selector, sin errores de consola | E |
| GRA-E02 | Todos / Ninguno / Top 5; la selección sobrevive a recargar | E |
| GRA-E03 | Cambiar categoría y temporada reinicia a top 5 y actualiza la URL | E |
| GRA-E04 | Clic/toque sobre la gráfica: tooltip con puntos y acumulado de cada piloto, dentro de la pantalla | E |
| GRA-E05 | Acumulado / Por carrera cambia URL y título | E |
| GRA-E06 | Sin desbordamiento horizontal con todos los pilotos | E |

Cruce completo con la base (2014 en adelante, Moto3/Moto2/MotoGP): `npx tsx scripts/check-points-progress.ts [año] [categoría]`.

## Sospechas y fallos encontrados

Estado tras ejecutar el plan (noviembre de 2026). Cada arreglo va en su rama `fix/`.

| # | Hallazgo | Estado |
|---|---|---|
| 1 | INI-02: próximo GP sin fecha lanzaba RangeError y rompía la tarjeta | Arreglado: "Fecha por confirmar" |
| 2 | INI-06: "Día de la Sprint" (zona del navegador) y "Hora peninsular" (Madrid) se contradecían cerca de medianoche | Arreglado (opción B): los dos en la zona del visitante, etiqueta "Tu hora" |
| 3 | INI-09: piloto sin posición se pintaba "00" con estilo de podio | Arreglado: "—" y sin podio |
| 4 | INI-10: Constructores no se recuperaba tras un error | Arreglado: botón "Reintentar" |
| 5 | PIL-06: la trayectoria junta temporadas no consecutivas | Aceptado: fuera de alcance mientras no se use la trayectoria; queda un `it.fails` |
| 6 | RAC2 era "Carrera 2" en resultados y "Carrera" en el calendario | Arreglado: "Carrera" en los dos |
| 7 | `/api/riders/standings` usa los puntos truncados y no filtra filas antiguas del premio BMW | API-04 no lo ha detectado con los datos actuales; sin cambios |
| 8 | Dos copias de `wallClockToInstant` que se comportan distinto sin zona | Sin cambios; CAL-13 cubre la de `src/utils/date.ts` |
| — | INI-01: sin ronda, el nombre corto sale en las dos etiquetas | Aceptado por el usuario: se deja como está |
| — | Errores de ESLint en Header, ThemeToggle y ResultsPage | Arreglados |
| — | El paquete de despliegue perdía `.next/server/app/api/dev` (500 en producción en vez de 404) | Arreglado (API-08) |
| — | Datos de producción desfasados: fin de sesión de Qatar y carrera de Moto3 de Malasia fuera del fin de semana (API-01) | Pendiente: la sincronización solo refresca sesiones de eventos activos |

Fuera del plan: "Calendario 2026", "Pilotos 2026" y el botón "2026" están fijos en el código a propósito; se sustituirán por funciones en el futuro.
