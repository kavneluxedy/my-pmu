import { describe, expect, it } from "vitest";
import { dutchByBudget, dutchByTargetProfit } from "./dutching.js";

describe("dutchByBudget", () => {
  it("répartit le budget pour un retour identique quel que soit le gagnant", () => {
    const res = dutchByBudget(
      { selections: [
        { selection: 1, odds: 2 },
        { selection: 2, odds: 4 },
        { selection: 3, odds: 6 },
      ] },
      100,
    );
    // Le budget total réparti doit rester ~100.
    expect(res.totalStake).toBeCloseTo(100, 1);
    // Le retour brut est identique sur chaque jambe.
    const returns = res.legs.map((l) => l.grossReturn);
    for (const r of returns) {
      expect(r).toBeCloseTo(res.guaranteedReturn, 0);
    }
  });

  it("somme des probabilités implicites cohérente (2/4/6)", () => {
    const res = dutchByBudget(
      { selections: [
        { selection: 1, odds: 2 },
        { selection: 2, odds: 4 },
        { selection: 3, odds: 6 },
      ] },
      100,
    );
    // 1/2 + 1/4 + 1/6 = 0.9166...
    expect(res.impliedProbabilitySum).toBeCloseTo(0.92, 2);
    // <1 → situation d'arbitrage (profit garanti positif).
    expect(res.isArbitrage).toBe(true);
    expect(res.guaranteedProfit).toBeGreaterThan(0);
  });

  it("pas d'arbitrage quand la somme des probas dépasse 1", () => {
    const res = dutchByBudget(
      { selections: [
        { selection: 1, odds: 1.5 },
        { selection: 2, odds: 2.5 },
      ] },
      100,
    );
    // 1/1.5 + 1/2.5 = 0.6667 + 0.4 = 1.0667 > 1.
    expect(res.impliedProbabilitySum).toBeCloseTo(1.07, 2);
    expect(res.isArbitrage).toBe(false);
    expect(res.guaranteedProfit).toBeLessThan(0);
  });

  it("rejette moins de deux sélections", () => {
    expect(() => dutchByBudget({ selections: [{ selection: 1, odds: 2 }] }, 100)).toThrow();
  });
});

describe("dutchByTargetProfit", () => {
  it("garantit le profit net visé en situation d'arbitrage", () => {
    const res = dutchByTargetProfit(
      { selections: [
        { selection: 1, odds: 2 },
        { selection: 2, odds: 4 },
        { selection: 3, odds: 6 },
      ] },
      50,
    );
    expect(res.guaranteedProfit).toBeCloseTo(50, 0);
  });

  it("refuse quand aucun profit garanti n'est possible", () => {
    expect(() =>
      dutchByTargetProfit(
        { selections: [
          { selection: 1, odds: 1.5 },
          { selection: 2, odds: 2.5 },
        ] },
        50,
      ),
    ).toThrow();
  });
});
