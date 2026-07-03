import { describe, expect, it } from "vitest";
import { computeBankrollStats } from "./stats.js";
import type { BetRecord } from "./types.js";

const bets: BetRecord[] = [
  { date: "2026-01-01", stake: 10, payout: 25, status: "won" },
  { date: "2026-01-02", stake: 10, payout: 0, status: "lost" },
  { date: "2026-01-03", stake: 20, payout: 0, status: "lost" },
  { date: "2026-01-04", stake: 10, payout: 40, status: "won" },
  { date: "2026-01-05", stake: 15, payout: null, status: "pending" },
];

describe("computeBankrollStats", () => {
  it("ignore les paris en attente dans les totaux", () => {
    const s = computeBankrollStats(bets);
    // Misé réglé : 10+10+20+10 = 50 (pas les 15 en attente).
    expect(s.totalStaked).toBe(50);
    expect(s.totalReturned).toBe(65);
    expect(s.netProfit).toBe(15);
    expect(s.settledBets).toBe(4);
  });

  it("calcule ROI, taux de réussite", () => {
    const s = computeBankrollStats(bets);
    expect(s.roi).toBe(30); // 15 / 50 = 30 %
    expect(s.wonBets).toBe(2);
    expect(s.hitRate).toBe(50); // 2 / 4
  });

  it("produit une courbe de solde cumulée triée par date", () => {
    const s = computeBankrollStats(bets);
    expect(s.balanceCurve).toEqual([
      { date: "2026-01-01", balance: 15 },
      { date: "2026-01-02", balance: 5 },
      { date: "2026-01-03", balance: -15 },
      { date: "2026-01-04", balance: 15 },
    ]);
  });

  it("renvoie des valeurs neutres pour un historique vide", () => {
    const s = computeBankrollStats([]);
    expect(s.roi).toBe(0);
    expect(s.hitRate).toBe(0);
    expect(s.balanceCurve).toEqual([]);
  });
});
