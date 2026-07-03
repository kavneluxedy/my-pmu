import { describe, expect, it } from "vitest";
import {
  arrangementCount,
  combinationCount,
  computePotentialPayout,
  computeTicketCost,
  countTicketCombinations,
} from "./combinations.js";

describe("combinationCount", () => {
  it("calcule les coefficients binomiaux usuels", () => {
    expect(combinationCount(5, 3)).toBe(10);
    expect(combinationCount(10, 2)).toBe(45);
    expect(combinationCount(4, 4)).toBe(1);
    expect(combinationCount(6, 0)).toBe(1);
  });

  it("renvoie 0 pour un k invalide", () => {
    expect(combinationCount(3, 5)).toBe(0);
  });
});

describe("arrangementCount", () => {
  it("compte les arrangements ordonnés", () => {
    // Tiercé dans l'ordre sur 4 chevaux : 4 × 3 × 2 = 24.
    expect(arrangementCount(4, 3)).toBe(24);
    expect(arrangementCount(5, 2)).toBe(20);
  });
});

describe("countTicketCombinations", () => {
  it("tiercé désordre, champ total de 4 chevaux → 4 combinaisons", () => {
    // C(4,3) = 4 façons de choisir 3 chevaux parmi 4.
    const n = countTicketCombinations("tierce", { associated: [1, 2, 3, 4] });
    expect(n).toBe(4);
  });

  it("tiercé ordre, champ total de 4 chevaux → 24 combinaisons", () => {
    const n = countTicketCombinations("tierce", {
      associated: [1, 2, 3, 4],
      ordered: true,
    });
    expect(n).toBe(24);
  });

  it("champ réduit avec 1 base et 3 associés pour un tiercé → 3 combinaisons", () => {
    // 1 base fixe + choisir 2 parmi 3 = C(3,2) = 3.
    const n = countTicketCombinations("tierce", {
      bases: [7],
      associated: [1, 2, 3],
    });
    expect(n).toBe(3);
  });

  it("quinté champ total de 6 → C(6,5) = 6", () => {
    const n = countTicketCombinations("quinte", { associated: [1, 2, 3, 4, 5, 6] });
    expect(n).toBe(6);
  });

  it("simple gagnant, 1 cheval associé → 1 combinaison", () => {
    expect(countTicketCombinations("simple_gagnant", { associated: [5] })).toBe(1);
  });

  it("simple placé, champ de 3 → 3 combinaisons (chacun joué seul)", () => {
    // C(3,1) = 3 : on joue 3 simples séparés.
    expect(countTicketCombinations("simple_place", { associated: [1, 2, 3] })).toBe(3);
  });

  it("rejette un champ insuffisant", () => {
    expect(() => countTicketCombinations("tierce", { associated: [1, 2] })).toThrow();
  });

  it("rejette trop de chevaux de base", () => {
    expect(() =>
      countTicketCombinations("couple_gagnant", { bases: [1, 2, 3], associated: [4] }),
    ).toThrow();
  });
});

describe("computeTicketCost", () => {
  it("multiplie le nombre de combinaisons par la mise unitaire", () => {
    const cost = computeTicketCost("tierce", { associated: [1, 2, 3, 4] }, 1.5);
    expect(cost.combinations).toBe(4);
    expect(cost.totalCost).toBe(6);
  });

  it("rejette une mise nulle ou négative", () => {
    expect(() => computeTicketCost("trio", { associated: [1, 2, 3] }, 0)).toThrow();
  });

  it("rejette une mise sous le minimum du type (simple gagnant < 2 €)", () => {
    expect(() =>
      computeTicketCost("simple_gagnant", { associated: [1] }, 1.5),
    ).toThrow();
    // 2 € est exactement le minimum : accepté.
    expect(computeTicketCost("simple_gagnant", { associated: [1] }, 2).totalCost).toBe(2);
  });

  it("accepte une mise au minimum spécifique du tiercé (1 €)", () => {
    const cost = computeTicketCost("tierce", { associated: [1, 2, 3, 4] }, 1);
    expect(cost.totalCost).toBe(4);
  });
});

describe("computePotentialPayout", () => {
  it("applique le rapport pour 1 € à la mise unitaire", () => {
    expect(computePotentialPayout(2, 34.5)).toBe(69);
  });
});
