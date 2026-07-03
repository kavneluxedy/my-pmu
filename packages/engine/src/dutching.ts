/**
 * Dutching : répartir une mise sur plusieurs partants de sorte que le retour
 * brut soit identique quel que soit le gagnant parmi les sélectionnés.
 *
 * Deux modes :
 *  - budget fixe à répartir (`totalStake`) ;
 *  - profit net garanti visé (`targetProfit`).
 */
import type { DutchingLeg, DutchingResult } from "./types.js";

export interface DutchingInput {
  /** Partants sélectionnés avec leur cote décimale (> 1). */
  selections: { selection: number | string; odds: number }[];
}

/** Somme des probabilités implicites (1/cote). <1 = arbitrage possible. */
function impliedProbabilitySum(odds: number[]): number {
  return odds.reduce((acc, o) => acc + 1 / o, 0);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function validate(input: DutchingInput): number[] {
  if (input.selections.length < 2) {
    throw new Error("Le dutching nécessite au moins deux sélections.");
  }
  const odds = input.selections.map((s) => s.odds);
  if (odds.some((o) => o <= 1)) {
    throw new Error("Chaque cote décimale doit être strictement supérieure à 1.");
  }
  return odds;
}

/**
 * Construit le résultat de dutching à partir d'un retour brut cible commun.
 * La mise sur chaque partant = retourCible / cote (pour que mise × cote = cible).
 */
function buildResult(
  input: DutchingInput,
  targetReturn: number,
): DutchingResult {
  const odds = input.selections.map((s) => s.odds);
  const legs: DutchingLeg[] = input.selections.map((s) => {
    const stake = round2(targetReturn / s.odds);
    return {
      selection: s.selection,
      odds: s.odds,
      stake,
      grossReturn: round2(stake * s.odds),
    };
  });
  const totalStake = round2(legs.reduce((acc, l) => acc + l.stake, 0));
  const probSum = impliedProbabilitySum(odds);
  return {
    legs,
    totalStake,
    guaranteedReturn: round2(targetReturn),
    guaranteedProfit: round2(targetReturn - totalStake),
    impliedProbabilitySum: round2(probSum),
    isArbitrage: probSum < 1,
  };
}

/** Dutching à budget fixe : on répartit `totalStake` entre les partants. */
export function dutchByBudget(
  input: DutchingInput,
  totalStake: number,
): DutchingResult {
  const odds = validate(input);
  if (totalStake <= 0) {
    throw new Error("Le budget total doit être strictement positif.");
  }
  // Retour brut commun R tel que Σ(R / cote_i) = totalStake
  //   ⇒ R = totalStake / Σ(1/cote_i).
  const targetReturn = totalStake / impliedProbabilitySum(odds);
  return buildResult(input, targetReturn);
}

/** Dutching à profit visé : on garantit `targetProfit` net quel que soit le gagnant. */
export function dutchByTargetProfit(
  input: DutchingInput,
  targetProfit: number,
): DutchingResult {
  const odds = validate(input);
  const probSum = impliedProbabilitySum(odds);
  if (probSum >= 1) {
    throw new Error(
      "Aucun profit garanti possible : la somme des probabilités implicites est ≥ 1 (marge défavorable).",
    );
  }
  // profit = R - totalStake = R - R·probSum = R·(1 - probSum)
  //   ⇒ R = targetProfit / (1 - probSum).
  const targetReturn = targetProfit / (1 - probSum);
  return buildResult(input, targetReturn);
}
