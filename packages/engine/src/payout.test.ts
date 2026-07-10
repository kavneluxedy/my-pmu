import { describe, expect, it } from "vitest";
import {
  computePayout,
  coupleGagnantFromMasses,
  couplePlaceFromMasses,
  payoutFromOdds,
  placesCount,
  simpleGagnantFromMasses,
  simplePlaceFromMasses,
} from "./payout.js";

describe("placesCount", () => {
  it("3 placés dès 8 partants, 2 de 4 à 7, aucun sous 4", () => {
    expect(placesCount(8)).toBe(3);
    expect(placesCount(12)).toBe(3);
    expect(placesCount(7)).toBe(2);
    expect(placesCount(4)).toBe(2);
    expect(placesCount(3)).toBe(0);
  });
});

describe("payoutFromOdds", () => {
  it("gain = mise × rapport (brut, net, ROI)", () => {
    const r = payoutFromOdds("simple_gagnant", 2, 4.5);
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(4.5, 2);
    expect(r.grossPayout).toBeCloseTo(9, 2);
    expect(r.netProfit).toBeCloseTo(7, 2);
    expect(r.returnOnStake).toBeCloseTo(4.5, 2);
    expect(r.mode).toBe("cote");
  });

  it("fonctionne pour Couplé Gagnant", () => {
    const r = payoutFromOdds("couple_gagnant", 2, 5.75);
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(5.7, 2); // arrondi au décime inf.
    expect(r.grossPayout).toBeCloseTo(11.4, 2);
    expect(r.mode).toBe("cote");
  });

  it("rejette un rapport inférieur à 1", () => {
    expect(() => payoutFromOdds("simple_gagnant", 2, 0.9)).toThrow();
  });

  it("rejette une mise sous le minimum du type (simple gagnant < 2 €)", () => {
    expect(() => payoutFromOdds("simple_gagnant", 1.5, 4.5)).toThrow();
  });
});

describe("simpleGagnantFromMasses", () => {
  it("rapport = (masse × TRJ) ÷ enjeux sur le cheval", () => {
    // 10000 × 0.85 / 1000 = 8,5.
    const r = simpleGagnantFromMasses(
      { totalPool: 10000, stakeOnHorse: 1000, runnersCount: 12 },
      2,
    );
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(8.5, 2);
    expect(r.grossPayout).toBeCloseTo(17, 2);
    expect(r.mode).toBe("masses");
  });

  it("applique le minimum garanti 1,10 sur un ultra-favori", () => {
    // 10000 × 0.85 / 9000 ≈ 0,94 < 1,10.
    const r = simpleGagnantFromMasses(
      { totalPool: 10000, stakeOnHorse: 9000, runnersCount: 12 },
      2,
    );
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(1.1, 2);
  });

  it("arrondit le rapport au décime inférieur", () => {
    // 10000 × 0.85 / 900 ≈ 9,444 → 9,4.
    const r = simpleGagnantFromMasses(
      { totalPool: 10000, stakeOnHorse: 900, runnersCount: 12 },
      2,
    );
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(9.4, 2);
  });

  it("respecte un TRJ surchargé", () => {
    // 10000 × 0.70 / 1000 = 7,0.
    const r = simpleGagnantFromMasses(
      { totalPool: 10000, stakeOnHorse: 1000, runnersCount: 12, trj: 0.7 },
      2,
    );
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(7, 2);
  });

  it("rejette une masse ou un enjeu nul, et un enjeu > masse", () => {
    expect(() =>
      simpleGagnantFromMasses({ totalPool: 0, stakeOnHorse: 100, runnersCount: 12 }, 2),
    ).toThrow();
    expect(() =>
      simpleGagnantFromMasses({ totalPool: 1000, stakeOnHorse: 0, runnersCount: 12 }, 2),
    ).toThrow();
    expect(() =>
      simpleGagnantFromMasses({ totalPool: 100, stakeOnHorse: 200, runnersCount: 12 }, 2),
    ).toThrow();
  });
});

describe("simplePlaceFromMasses", () => {
  it("partage la masse en 3 dès 8 partants", () => {
    // 10000 × 0.85 / 3 / 1000 ≈ 2,833 → 2,8.
    const r = simplePlaceFromMasses(
      { totalPool: 10000, stakeOnHorse: 1000, runnersCount: 12 },
      2,
    );
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(2.8, 2);
  });

  it("partage la masse en 2 de 4 à 7 partants", () => {
    // 10000 × 0.85 / 2 / 1000 = 4,25 → 4,2.
    const r = simplePlaceFromMasses(
      { totalPool: 10000, stakeOnHorse: 1000, runnersCount: 6 },
      2,
    );
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(4.2, 2);
  });

  it("rejette moins de 4 partants (aucun placé payé)", () => {
    expect(() =>
      simplePlaceFromMasses({ totalPool: 10000, stakeOnHorse: 1000, runnersCount: 3 }, 2),
    ).toThrow();
  });

  it("applique le minimum garanti 1,10", () => {
    // 10000 × 0.85 / 3 / 3000 ≈ 0,94 < 1,10.
    const r = simplePlaceFromMasses(
      { totalPool: 10000, stakeOnHorse: 3000, runnersCount: 12 },
      2,
    );
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(1.1, 2);
  });
});

describe("coupleGagnantFromMasses", () => {
  it("rapport = (masse × TRJ) ÷ enjeux sur la combinaison", () => {
    // 5000 × 0.76 / 200 = 19.
    const r = coupleGagnantFromMasses(
      { totalPool: 5000, stakeOnCombination: 200 },
      2,
    );
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(19, 2);
  });

  it("rejette un enjeu de combinaison nul", () => {
    expect(() =>
      coupleGagnantFromMasses({ totalPool: 5000, stakeOnCombination: 0 }, 2),
    ).toThrow();
  });
});

describe("couplePlaceFromMasses", () => {
  it("divise la masse par 3 combinaisons gagnantes", () => {
    // 5000 × 0.76 / 3 / 200 ≈ 6,333 → 6,3.
    const r = couplePlaceFromMasses(
      { totalPool: 5000, stakeOnCombination: 200 },
      2,
    );
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(6.3, 2);
  });

  it("calcule avec des chiffres réels (R2C4, paire 7-9, TRJ 0.76)", () => {
    // totalPool=3751452, stakeOnCombination=498435, TRJ 0.76
    // rapport = (3751452 × 0.76) / 3 / 498435 ≈ 1,905 → 1,9
    const r = couplePlaceFromMasses(
      { totalPool: 3751452, stakeOnCombination: 498435, trj: 0.76 },
      2, // mise minimale 2 € pour couplé
    );
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(1.9, 1);
  });

  it("rejette un enjeu de combinaison nul", () => {
    expect(() =>
      couplePlaceFromMasses({ totalPool: 5000, stakeOnCombination: 0 }, 2),
    ).toThrow();
  });
});

describe("computePayout (façade)", () => {
  it("route vers le mode cote", () => {
    const r = computePayout({
      betType: "simple_gagnant",
      unitStake: 2,
      mode: "cote",
      rapportBrutPourUnEuro: 4.5,
    });
    expect(r.grossPayout).toBeCloseTo(9, 2);
  });

  it("route vers le bon calcul de masses selon le type", () => {
    const r = computePayout({
      betType: "couple_place",
      unitStake: 2,
      mode: "masses",
      masses: { totalPool: 5000, stakeOnCombination: 200 },
    });
    expect(r.rapportBrutPourUnEuro).toBeCloseTo(6.3, 2);
  });

  it("rejette le mode cote sans rapport", () => {
    expect(() =>
      computePayout({ betType: "simple_gagnant", unitStake: 2, mode: "cote" }),
    ).toThrow();
  });

  it("rejette le mode masses sans enjeux", () => {
    expect(() =>
      computePayout({ betType: "simple_gagnant", unitStake: 2, mode: "masses" }),
    ).toThrow();
  });
});
