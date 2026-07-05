import { describe, expect, it } from "vitest";
import { evaluate, parseNums, tryEvaluate } from "./calc.js";

describe("evaluate — nombres et décimaux", () => {
  it("évalue un entier", () => {
    expect(evaluate("42")).toBe(42);
  });
  it("évalue un décimal", () => {
    expect(evaluate("0.4")).toBeCloseTo(0.4, 10);
  });
  it("évalue un décimal commençant par un point", () => {
    expect(evaluate(".5")).toBeCloseTo(0.5, 10);
  });
});

describe("evaluate — fractions", () => {
  it("évalue une fraction simple", () => {
    expect(evaluate("3/8")).toBeCloseTo(0.375, 10);
  });
  it("évalue une fraction menant à un décimal périodique", () => {
    expect(evaluate("1/3")).toBeCloseTo(0.333333, 5);
  });
  it("rejette la division par zéro", () => {
    expect(() => evaluate("1/0")).toThrow(/[Dd]ivision par zéro/);
  });
});

describe("evaluate — pourcentages", () => {
  it("convertit un pourcentage entier", () => {
    expect(evaluate("40%")).toBeCloseTo(0.4, 10);
  });
  it("convertit un pourcentage décimal", () => {
    expect(evaluate("12.5%")).toBeCloseTo(0.125, 10);
  });
  it("gère un pourcentage dans une expression", () => {
    expect(evaluate("40% + 10%")).toBeCloseTo(0.5, 10);
  });
});

describe("evaluate — opérateurs et priorité", () => {
  it("respecte la priorité multiplication/addition", () => {
    expect(evaluate("2 + 3 * 4")).toBe(14);
  });
  it("respecte les parenthèses", () => {
    expect(evaluate("(2 + 3) * 4")).toBe(20);
  });
  it("évalue une expression de proba composée", () => {
    // 1 / (1 + 1.5 + 2) => une part sur un total de cotes.
    expect(evaluate("1/(1+1.5+2)")).toBeCloseTo(1 / 4.5, 10);
  });
  it("gère le signe unaire négatif", () => {
    expect(evaluate("-3 + 5")).toBe(2);
  });
  it("gère le signe unaire positif", () => {
    expect(evaluate("+3")).toBe(3);
  });
  it("soustractions successives associées à gauche", () => {
    expect(evaluate("10 - 3 - 2")).toBe(5);
  });
  it("divisions successives associées à gauche", () => {
    expect(evaluate("100 / 5 / 2")).toBe(10);
  });
  it("ignore les espaces", () => {
    expect(evaluate("  3  /  8  ")).toBeCloseTo(0.375, 10);
  });
});

describe("evaluate — erreurs", () => {
  it("rejette une expression vide", () => {
    expect(() => evaluate("")).toThrow();
  });
  it("rejette un caractère non autorisé", () => {
    expect(() => evaluate("3 & 8")).toThrow(/[Cc]aractère/);
  });
  it("rejette une parenthèse non fermée", () => {
    expect(() => evaluate("(1+2")).toThrow();
  });
  it("rejette un opérateur en trop", () => {
    expect(() => evaluate("3 * * 8")).toThrow();
  });
  it("rejette des jetons résiduels", () => {
    expect(() => evaluate("3 8")).toThrow();
  });
});

describe("tryEvaluate", () => {
  it("renvoie la valeur pour une expression valide", () => {
    expect(tryEvaluate("3/8")).toBeCloseTo(0.375, 10);
  });
  it("renvoie null pour une expression vide", () => {
    expect(tryEvaluate("")).toBeNull();
    expect(tryEvaluate("   ")).toBeNull();
  });
  it("renvoie null pour une expression invalide", () => {
    expect(tryEvaluate("1/0")).toBeNull();
    expect(tryEvaluate("(1+")).toBeNull();
    expect(tryEvaluate("abc")).toBeNull();
  });
});

describe("parseNums", () => {
  it("parse une liste séparée par des virgules", () => {
    expect(parseNums("1,2,3")).toEqual([1, 2, 3]);
  });
  it("gère les mélanges de virgules et d'espaces", () => {
    expect(parseNums("2, 4  6")).toEqual([2, 4, 6]);
  });
  it("parse les décimaux", () => {
    expect(parseNums("2.5, 4")).toEqual([2.5, 4]);
  });
  it("ignore les entrées non numériques", () => {
    expect(parseNums("1, abc, 3")).toEqual([1, 3]);
  });
  it("ignore un tronçon vide entre deux séparateurs", () => {
    expect(parseNums("1,,3")).toEqual([1, 3]);
  });
});
