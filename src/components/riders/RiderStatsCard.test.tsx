// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { RiderCarouselItem } from "@/types/riderCarousel";
import { RiderStatsCard, type StatsTabKey } from "./RiderStatsCard";
import { paso, piloto } from "./__fixtures__/pilotos";

function Arnes({ rider, inicial = "season" }: { rider: RiderCarouselItem; inicial?: StatsTabKey }) {
  const [tab, setTab] = useState<StatsTabKey>(inicial);
  return <RiderStatsCard rider={rider} season={2026} category="MotoGP" tab={tab} onTabChange={setTab} />;
}

const montar = (rider = piloto(), inicial: StatsTabKey = "season") => {
  render(<Arnes rider={rider} inicial={inicial} />);
  return userEvent.setup();
};

const pestana = (name: string) => screen.getByRole("tab", { name });

describe("RiderStatsCard: pestañas (PIL-05)", () => {
  it("cinco pestañas, la de temporada seleccionada y solo ella en el orden de tabulación", () => {
    montar();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Temporada", "Victorias y poles", "Carreras", "Mundiales", "Trayectoria",
    ]);
    expect(pestana("Temporada")).toHaveAttribute("aria-selected", "true");
    expect(pestana("Temporada")).toHaveAttribute("tabindex", "0");
    expect(pestana("Carreras")).toHaveAttribute("tabindex", "-1");
  });

  it("clic cambia de pestaña y el panel queda etiquetado por ella", async () => {
    const user = montar();
    await user.click(pestana("Carreras"));
    expect(pestana("Carreras")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", pestana("Carreras").id);
  });

  it("flechas mueven el foco y la selección, de forma circular", async () => {
    const user = montar();
    pestana("Temporada").focus();
    await user.keyboard("{ArrowLeft}");
    expect(pestana("Trayectoria")).toHaveAttribute("aria-selected", "true");
    expect(pestana("Trayectoria")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(pestana("Temporada")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(pestana("Victorias y poles")).toHaveFocus();
  });

  it("Fin va a la última y Inicio a la primera", async () => {
    const user = montar();
    pestana("Temporada").focus();
    await user.keyboard("{End}");
    expect(pestana("Trayectoria")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(pestana("Temporada")).toHaveAttribute("aria-selected", "true");
  });
});

describe("RiderStatsCard: temporada (PIL-05)", () => {
  it("con datos: posición, puntos y resumen en plural/singular", () => {
    montar(piloto({ season_stats: { position: 1, points: 1, wins: 1, podiums: 2, poles: 0, sprint_wins: 3 } }));
    expect(screen.getByText("Temporada 2026 · MotoGP")).toBeInTheDocument();
    expect(screen.getByText("1º")).toBeInTheDocument();
    expect(screen.getByText("Sprints ganadas")).toBeInTheDocument();
    expect(screen.getByText("En 2026, 1ª posición, 1 punto, 1 victoria, 2 podios, 0 poles.")).toBeInTheDocument();
  });

  it("sin sprint_wins (Moto2/Moto3) no sale 'Sprints ganadas'", () => {
    montar(piloto({ season_stats: { position: 4, points: 80, wins: 0, podiums: 1, poles: 0, sprint_wins: null } }));
    expect(screen.queryByText("Sprints ganadas")).not.toBeInTheDocument();
  });

  it("posición y puntos nulos: raya y sin resumen de esos datos", () => {
    montar(piloto({ season_stats: { position: null, points: null, wins: 0, podiums: 0, poles: 0, sprint_wins: null } }));
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("En 2026, 0 victorias, 0 podios, 0 poles.")).toBeInTheDocument();
  });

  it("sin datos de temporada: mensaje vacío", () => {
    montar(piloto({ season_stats: null }));
    expect(
      screen.getByText(/Todavía no hay datos de Piloto Uno en la temporada 2026 de\s+MotoGP, por ejemplo si es suplente/)
    ).toBeInTheDocument();
  });
});

describe("RiderStatsCard: victorias y poles y carreras (PIL-05)", () => {
  it("MotoGP con 500cc: 'En MotoGP' y 'Clase reina' (totales distintos)", async () => {
    const user = montar(piloto({ motogp: { wins: 10, poles: 5, premier_wins: 15, premier_poles: 8, sprint_wins: 2 } }));
    await user.click(pestana("Victorias y poles"));
    expect(screen.getByText("En MotoGP")).toBeInTheDocument();
    expect(screen.getByText("Clase reina · 500cc + MotoGP")).toBeInTheDocument();
    expect(screen.getByText("Los totales de carrera no incluyen las carreras sprint.")).toBeInTheDocument();
  });

  it("sin diferencia con la clase reina, esa sección se oculta", async () => {
    const user = montar(piloto({ motogp: { wins: 10, poles: 5, premier_wins: 10, premier_poles: 5, sprint_wins: 2 } }));
    await user.click(pestana("Victorias y poles"));
    expect(screen.getByText("En MotoGP")).toBeInTheDocument();
    expect(screen.queryByText(/Clase reina/)).not.toBeInTheDocument();
  });

  it("Moto2/Moto3 (motogp null): solo 'Toda la carrera', sin nota de sprints", async () => {
    const user = montar(piloto({ motogp: null }));
    await user.click(pestana("Victorias y poles"));
    expect(screen.getByText("Toda la carrera")).toBeInTheDocument();
    expect(screen.queryByText("En MotoGP")).not.toBeInTheDocument();
    expect(screen.queryByText(/no incluyen las carreras sprint/)).not.toBeInTheDocument();
  });

  it("carreras: porcentaje de podios redondeado y nota solo con MotoGP", async () => {
    const user = montar(piloto({ career: { ...piloto().career, starts: 3, podiums: 1 } }));
    await user.click(pestana("Carreras"));
    expect(screen.getByText("Sube al podio en el 33 % de las carreras que disputa.")).toBeInTheDocument();
    expect(screen.getByText("Solo cuentan las carreras del domingo, sin las sprint.")).toBeInTheDocument();
  });

  it("carreras sin salidas: sin porcentaje (evita dividir por cero)", async () => {
    const user = montar(piloto({ motogp: null, career: { ...piloto().career, starts: 0, podiums: 0 } }));
    await user.click(pestana("Carreras"));
    expect(screen.queryByText(/Sube al podio/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Solo cuentan/)).not.toBeInTheDocument();
  });
});

describe("RiderStatsCard: mundiales (PIL-05)", () => {
  it("sin títulos: mensaje vacío con la nota de la temporada en curso", async () => {
    const user = montar();
    await user.click(pestana("Mundiales"));
    expect(screen.getByText(/Piloto Uno todavía no ha ganado ningún Mundial/)).toBeInTheDocument();
    expect(screen.getByText("La temporada en curso no cuenta hasta que termine.")).toBeInTheDocument();
  });

  it("las categorías con años vacíos no cuentan", async () => {
    const user = montar(piloto({ career: { ...piloto().career, titles: [{ category: "Moto2™", years: [] }] } }));
    await user.click(pestana("Mundiales"));
    expect(screen.getByText(/todavía no ha ganado ningún Mundial/)).toBeInTheDocument();
  });

  it("un título: singular; varios: plural; clase reina primero, años ordenados, sin ™", async () => {
    const user = montar(
      piloto({
        career: {
          ...piloto().career,
          titles: [
            { category: "Moto3™", years: [2011] },
            { category: "MotoGP™", years: [2019, 2013, 2016] },
          ],
        },
      })
    );
    await user.click(pestana("Mundiales"));
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Mundiales ganados")).toBeInTheDocument();
    expect(screen.getByText("3 títulos")).toBeInTheDocument();
    expect(screen.getByText("1 título")).toBeInTheDocument();
    const categorias = screen.getAllByRole("listitem").filter((li) => li.querySelector("ul"));
    expect(categorias[0]).toHaveTextContent("MotoGP");
    expect(categorias[0]).not.toHaveTextContent("™");
    expect(categorias[0].querySelectorAll("li")).toHaveLength(3);
    expect(Array.from(categorias[0].querySelectorAll("li")).map((l) => l.textContent)).toEqual(["2013", "2016", "2019"]);
    expect(categorias[1]).toHaveTextContent("Moto3");
  });

  it("un único Mundial: 'Mundial ganado'", async () => {
    const user = montar(piloto({ career: { ...piloto().career, titles: [{ category: "Moto2™", years: [2018] }] } }));
    await user.click(pestana("Mundiales"));
    expect(screen.getByText("Mundial ganado")).toBeInTheDocument();
  });
});

describe("RiderStatsCard: trayectoria (PIL-05)", () => {
  it("sin trayectoria: mensaje vacío", async () => {
    const user = montar();
    await user.click(pestana("Trayectoria"));
    expect(screen.getByText("Todavía no hay trayectoria registrada de Piloto Uno.")).toBeInTheDocument();
  });

  it("tramos con rango de años, más reciente arriba, dorsal, equipo y marca", async () => {
    const user = montar(
      piloto({
        trajectory: [
          paso(2016), paso(2017), paso(2018),
          paso(2019, { category: "MotoGP™", team_name: null, constructor_name: null, number: null }),
        ],
      })
    );
    await user.click(pestana("Trayectoria"));
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("2019");
    expect(items[0]).toHaveTextContent("MotoGP");
    expect(items[0]).not.toHaveTextContent("#");
    expect(items[0]).toHaveTextContent("—");
    expect(items[1]).toHaveTextContent("2016–2018");
    expect(items[1]).toHaveTextContent("Moto2");
    expect(items[1]).toHaveTextContent("#10");
    expect(items[1]).toHaveTextContent("Equipo A");
    expect(items[1]).toHaveTextContent("Kalex");
  });
});
