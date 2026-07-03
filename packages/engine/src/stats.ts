/**
 * Statistiques de bankroll calculées à partir de l'historique des paris.
 * ROI, yield, taux de réussite, profit net et courbe de solde cumulé.
 */
import type { BankrollStats, BetRecord } from "./types.js";

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Un pari est « réglé » s'il est gagné ou perdu (pas en attente). */
function isSettled(bet: BetRecord): boolean {
  return bet.status === "won" || bet.status === "lost";
}

/**
 * Agrège les statistiques de bankroll sur les paris réglés.
 * Les paris `pending` sont ignorés pour le ROI mais pourraient être affichés à part.
 */
export function computeBankrollStats(bets: BetRecord[]): BankrollStats {
  const settled = bets.filter(isSettled);

  let totalStaked = 0;
  let totalReturned = 0;
  let wonBets = 0;

  for (const bet of settled) {
    totalStaked += bet.stake;
    totalReturned += bet.payout ?? 0;
    if (bet.status === "won") wonBets += 1;
  }

  const netProfit = totalReturned - totalStaked;

  // Courbe de solde : cumul du profit net (payout - stake) par pari, trié par date.
  const sortedByDate = [...settled].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const balanceCurve = sortedByDate.map((bet) => {
    running += (bet.payout ?? 0) - bet.stake;
    return { date: bet.date, balance: round2(running) };
  });

  return {
    totalStaked: round2(totalStaked),
    totalReturned: round2(totalReturned),
    netProfit: round2(netProfit),
    roi: totalStaked > 0 ? round2((netProfit / totalStaked) * 100) : 0,
    settledBets: settled.length,
    wonBets,
    hitRate: settled.length > 0 ? round2((wonBets / settled.length) * 100) : 0,
    balanceCurve,
  };
}
