import { describe, expect, it } from "vitest";
import {
  BET_TYPE_LABELS,
  BET_TYPE_MIN_STAKE,
  BET_TYPE_ORDERED,
  BET_TYPE_POSITIONS,
  BET_TYPES,
  minStakeFor,
} from "./types.js";

describe("types de paris", () => {
  it("le « 2 sur 4 » est défini avec 2 positions et un minimum de 3 €", () => {
    expect(BET_TYPE_POSITIONS.deux_sur_quatre).toBe(2);
    expect(BET_TYPE_ORDERED.deux_sur_quatre).toBe(false);
    expect(BET_TYPE_MIN_STAKE.deux_sur_quatre).toBe(3);
    expect(BET_TYPE_LABELS.deux_sur_quatre).toBe("2 sur 4");
    expect(BET_TYPES).toContain("deux_sur_quatre");
  });

  it("minStakeFor reflète les seuils pmu.fr par type", () => {
    expect(minStakeFor("simple_gagnant")).toBe(2);
    expect(minStakeFor("tierce")).toBe(1);
    expect(minStakeFor("quarte")).toBe(1.5);
    expect(minStakeFor("multi")).toBe(3);
  });

  it("chaque type listé possède position, ordre, minimum et libellé", () => {
    for (const t of BET_TYPES) {
      expect(BET_TYPE_POSITIONS[t]).toBeGreaterThan(0);
      expect(typeof BET_TYPE_ORDERED[t]).toBe("boolean");
      expect(BET_TYPE_MIN_STAKE[t]).toBeGreaterThan(0);
      expect(BET_TYPE_LABELS[t]).toBeTruthy();
    }
  });
});
