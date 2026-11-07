// Respuesta de /api/next-gp (forma snake_case de la API externa).
export const nextGp = {
  id: "evt-qat",
  sponsored_name: "Gran Premio de Qatar",
  name: "Qatar",
  additional_name: "Circuito de Lusail",
  short_name: "QAT",
  date_start: "2026-03-06",
  date_end: "2026-03-08",
  flag_url: null,
  status: "NOT-STARTED",
  round: 2,
  country: { iso: "QA", name: "Qatar", region_iso: "AS" },
  circuit: { id: "lusail", name: "Lusail International Circuit", place: "Lusail", nation: "QAT" },
  nextMotoGPRace: "2026-03-08T17:00:00.000Z",
  race: { seasonUuid: "s", eventUuid: "e", categoryUuid: "c", sessionUuid: "r" },
};

// Sin ronda: la etiqueta cae a short_name.
export const nextGpSinRonda = { ...nextGp, round: null, status: "CURRENT" };

// Evento sin fechas (formatDate("") lanza RangeError).
export const nextGpSinFecha = { ...nextGp, date_start: "", date_end: "" };

// Circuito con datos de pista y sprint, para ChampionshipStats.
export const nextGpConPista = {
  ...nextGp,
  circuit: {
    ...nextGp.circuit,
    track: {
      eventUuid: "e",
      lengthKm: 5.38,
      totalCorners: 16,
      laps: 22,
      infoImageUrl: "https://photos.motogp.com/circuito.svg",
      sprintDate: "2026-03-07T14:00:00.000Z",
      sprintLaps: 11,
    },
  },
};

// Sin datos de pista: todo debe salir como "—".
export const nextGpSinPista = {
  ...nextGp,
  circuit: {
    ...nextGp.circuit,
    track: {
      eventUuid: "e",
      lengthKm: null,
      totalCorners: null,
      laps: null,
      infoImageUrl: null,
      sprintDate: null,
      sprintLaps: null,
    },
  },
};
