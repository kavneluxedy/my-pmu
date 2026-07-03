import { describe, expect, it } from "vitest";
import {
  analyzeValueBet,
  expectedValue,
  fairProbabilities,
  impliedProbability,
  kellyStake,
} from "./valuebet.js";

describe("impliedProbability", () => {
  it("inverse la cote décimale", () => {
    expect(impliedProbability(4)).toBeCloseTo(0.25, 5);
    expect(impliedProbability(2)).toBeCloseTo(0.5, 5);
  });
  it("rejette une cote ≤ 1", () => {
    expect(() => impliedProbability(1)).toThrow();
  });
});

describe("fairProbabilities", () => {
  it("normalise à 1 après retrait de la marge", () => {
    const probs = fairProbabilities([2, 4, 6]);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 4);
  });
});

describe("expectedValue", () => {
  it("EV positive quand proba > proba implicite (cote 3, p=0.40)", () => {
    // Proba implicite = 1/3 ≈ 0.333 ; p=0.40 > seuil → EV > 0.
    expect(expectedValue(0.4, 3, 10)).toBeGreaterThan(0);
  });
  it("EV négative quand proba < proba implicite (cote 3, p=0.30)", () => {
    expect(expectedValue(0.3, 3, 10)).toBeLessThan(0);
  });
  it("EV nulle au point d'équilibre (cote 3, p=1/3)", () => {
    expect(expectedValue(1 / 3, 3, 10)).toBeCloseTo(0, 1);
  });
});

describe("kellyStake", () => {
  it("renvoie 0 quand il n'y a pas de valeur", () => {
    expect(kellyStake(0.3, 3, 1000)).toBe(0);
  });
  it("propose une mise positive quand il y a de la valeur", () => {
    const stake = kellyStake(0.5, 3, 1000, 1);
    expect(stake).toBeGreaterThan(0);
    expect(stake).toBeLessThanOrEqual(1000);
  });
  it("le Kelly fractionné réduit la mise", () => {
    const full = kellyStake(0.5, 3, 1000, 1);
    const quarter = kellyStake(0.5, 3, 1000, 0.25);
    expect(quarter).toBeLessThan(full);
  });
});

describe("analyzeValueBet", () => {
  it("qualifie un value bet et calcule la mise Kelly", () => {
    const res = analyzeValueBet({
      odds: 3,
      estimatedProbability: 0.4,
      stake: 10,
      bankroll: 1000,
    });
    expect(res.isValueBet).toBe(true);
    expect(res.edge).toBeGreaterThan(0);
    expect(res.kellyStake).toBeGreaterThan(0);
  });

  it("ne qualifie pas un pari sans valeur", () => {
    const res = analyzeValueBet({ odds: 3, estimatedProbability: 0.3, stake: 10 });
    expect(res.isValueBet).toBe(false);
    expect(res.kellyStake).toBe(0);
  });

  it("rejette une probabilité hors [0,1]", () => {
    expect(() => analyzeValueBet({ odds: 3, estimatedProbability: 1.5 })).toThrow();
  });
});
