/**
 * Analyse de value bet : comparer la probabilité estimée d'un cheval à la
 * probabilité implicite de sa cote pour détecter une valeur positive (EV+),
 * et proposer une mise via le critère de Kelly fractionné.
 */
import { type BetType, minStakeFor, type ValueBetResult } from "./types.js";

export interface ValueBetInput {
  /** Cote décimale (> 1). */
  odds: number;
  /** Probabilité estimée de gain (0..1). */
  estimatedProbability: number;
  /** Mise de référence pour le calcul de l'espérance. */
  stake?: number;
  /**
   * Type de pari. Si fourni, la mise de référence doit respecter le minimum
   * pmu.fr associé (sinon une erreur est levée). Optionnel pour rétrocompatibilité.
   */
  betType?: BetType;
  /** Bankroll pour dimensionner la mise de Kelly. */
  bankroll?: number;
  /**
   * Fraction de Kelly appliquée (0..1). 1 = Kelly complet ; 0.25 = quart de
   * Kelly (recommandé, plus prudent). Défaut : 0.25.
   */
  kellyFraction?: number;
  /** Seuil d'edge minimal pour qualifier un value bet (défaut 0). */
  edgeThreshold?: number;
}

function round(x: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

/** Probabilité implicite brute d'une cote décimale. */
export function impliedProbability(odds: number): number {
  if (odds <= 1) throw new Error("La cote décimale doit être supérieure à 1.");
  return 1 / odds;
}

/**
 * Retire la marge du bookmaker (overround) d'un ensemble de cotes pour obtenir
 * des probabilités « fair » normalisées à 1. Utile pour dériver des probabilités
 * exploitables directement à partir des cotes du marché.
 */
export function fairProbabilities(oddsList: number[]): number[] {
  const raw = oddsList.map((o) => impliedProbability(o));
  const overround = raw.reduce((a, b) => a + b, 0);
  return raw.map((p) => round(p / overround));
}

/** Espérance de gain nette pour une mise donnée. */
export function expectedValue(
  estimatedProbability: number,
  odds: number,
  stake: number,
): number {
  // EV = p·(cote−1)·mise − (1−p)·mise
  const win = estimatedProbability * (odds - 1) * stake;
  const lose = (1 - estimatedProbability) * stake;
  return round(win - lose, 2);
}

/**
 * Mise conseillée par le critère de Kelly (fractionné).
 * f* = (b·p − q) / b, avec b = cote−1, q = 1−p. Bornée à [0, bankroll].
 */
export function kellyStake(
  estimatedProbability: number,
  odds: number,
  bankroll: number,
  fraction = 0.25,
): number {
  const b = odds - 1;
  const p = estimatedProbability;
  const q = 1 - p;
  const f = (b * p - q) / b;
  if (f <= 0) return 0;
  return round(Math.min(f * fraction, 1) * bankroll, 2);
}

/** Analyse complète d'un pari : EV, edge, qualification value bet, mise Kelly. */
export function analyzeValueBet(input: ValueBetInput): ValueBetResult {
  const {
    odds,
    estimatedProbability,
    stake = 1,
    bankroll = 0,
    kellyFraction = 0.25,
    edgeThreshold = 0,
    betType,
  } = input;

  if (estimatedProbability < 0 || estimatedProbability > 1) {
    throw new Error("La probabilité estimée doit être comprise entre 0 et 1.");
  }
  if (betType) {
    const min = minStakeFor(betType);
    if (stake < min) {
      throw new Error(
        `La mise doit être d'au moins ${min} € pour ce type de pari (règle pmu.fr).`,
      );
    }
  }
  const implied = impliedProbability(odds);
  const ev = expectedValue(estimatedProbability, odds, stake);
  // Edge = valeur relative = p_estimée · cote − 1.
  const edge = round(estimatedProbability * odds - 1);

  return {
    odds,
    impliedProbability: round(implied),
    estimatedProbability,
    expectedValue: ev,
    edge,
    isValueBet: edge > edgeThreshold,
    kellyStake: bankroll > 0 ? kellyStake(estimatedProbability, odds, bankroll, kellyFraction) : 0,
  };
}
