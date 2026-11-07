// Respuestas de /api/riders/standings y /api/constructors/standings.
function piloto(
  id: string,
  full_name: string,
  number: number,
  position: number,
  points: number,
  wins = 0,
  iso = "ES"
) {
  return {
    id,
    full_name,
    country: { iso, name: iso ? "España" : "", flag_url: null },
    legacy_id: number,
    riders_id: id,
    number,
    team: { id: `t-${id}`, name: `Equipo ${full_name}`, legacy_id: 1, color: null },
    statistics: {
      constructor: "Ducati",
      starts: 10,
      first_position: wins,
      second_position: 0,
      third_position: 0,
      podiums: wins,
      poles: 0,
      points,
      position,
    },
  };
}

// Empate a puntos arriba (Uno y Dos) y entre el 3.º y el 4.º; el último sin país.
export const pilotosConEmpates = [
  piloto("p1", "Piloto Uno", 1, 1, 200, 5),
  piloto("p2", "Piloto Dos", 2, 1, 200, 4),
  piloto("p3", "Piloto Tres", 3, 3, 150, 1),
  piloto("p4", "Piloto Cuatro", 4, 3, 150, 0),
  piloto("p5", "Piloto Cinco", 5, 5, 90, 0, ""),
];

// Piloto sin posición de campeonato (position 0).
export const pilotosPosicionNula = [
  piloto("p1", "Piloto Uno", 1, 1, 50, 2),
  piloto("p9", "Piloto Sin Posición", 99, 0, 0),
];

export const constructoresConEmpate = [
  { id: "c1", name: "Ducati Lenovo", position: 1, points: 300, wins: 5, poles: 3, color: null },
  { id: "c2", name: "Aprilia Racing", position: 2, points: 300, wins: 3, poles: 4, color: null },
  { id: "c3", name: "KTM Factory", position: 3, points: 120, wins: 0, poles: 0, color: null },
  { id: "c4", name: "Equipo Raro", position: 4, points: 10, wins: 0, poles: 0, color: null },
];
