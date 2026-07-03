/**
 * Calcul du coût et du gain potentiel des tickets combinés hippiques
 * (Trio, Tiercé, Quarté+, Quinté+, Couplé…), avec gestion des champs
 * réduits (chevaux « de base » imposés + chevaux associés).
 */
import {
  BET_TYPE_ORDERED,
  BET_TYPE_POSITIONS,
  type BetType,
  minStakeFor,
  type TicketCost,
  type TicketSelection,
} from "./types.js";

/** Nombre de combinaisons de k éléments parmi n (coefficient binomial). */
export function combinationCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  // On calcule de façon itérative pour éviter les grands factoriels.
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < kk; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/** Nombre d'arrangements de k éléments parmi n (ordre compté). */
export function arrangementCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result *= n - i;
  }
  return result;
}

/**
 * Nombre de combinaisons jouées pour une sélection donnée.
 *
 * Modèle « champ réduit » : les chevaux de base sont dans chaque combinaison,
 * on complète avec des chevaux tirés du champ associé pour atteindre le nombre
 * de positions requis par le type de pari.
 */
export function countTicketCombinations(
  betType: BetType,
  selection: TicketSelection,
): number {
  const positions = BET_TYPE_POSITIONS[betType];
  const bases = selection.bases ?? [];
  const associated = selection.associated;

  // Contrôles de cohérence.
  const uniqueBases = new Set(bases);
  const uniqueAssociated = new Set(associated.filter((h) => !uniqueBases.has(h)));

  if (uniqueBases.size > positions) {
    throw new Error(
      `Trop de chevaux de base (${uniqueBases.size}) pour un pari à ${positions} positions.`,
    );
  }

  const remaining = positions - uniqueBases.size;
  if (uniqueAssociated.size < remaining) {
    throw new Error(
      `Champ insuffisant : ${uniqueAssociated.size} chevaux associés pour ${remaining} places à compléter.`,
    );
  }

  const base = combinationCount(uniqueAssociated.size, remaining);
  const ordered = selection.ordered ?? BET_TYPE_ORDERED[betType];

  // En version « ordre », chaque combinaison de chevaux se décline en
  // factorielle(positions) arrangements possibles.
  return ordered ? base * factorial(positions) : base;
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Coût total d'un ticket combiné pour une mise unitaire donnée. */
export function computeTicketCost(
  betType: BetType,
  selection: TicketSelection,
  unitStake: number,
): TicketCost {
  const min = minStakeFor(betType);
  if (unitStake < min) {
    throw new Error(
      `La mise unitaire doit être d'au moins ${min} € pour ce type de pari (règle pmu.fr).`,
    );
  }
  const combinations = countTicketCombinations(betType, selection);
  return {
    betType,
    combinations,
    unitStake,
    totalCost: round2(combinations * unitStake),
  };
}

/**
 * Gain potentiel d'un ticket si l'arrivée jouée sort.
 *
 * `rapportPourUnEuro` est le rapport PMU rapporté à 1 € de mise (tel que publié
 * ou importé). Le gain = mise unitaire × rapport (une seule combinaison gagnante
 * dans un pari combiné classique).
 */
export function computePotentialPayout(
  unitStake: number,
  rapportPourUnEuro: number,
): number {
  if (rapportPourUnEuro < 0) {
    throw new Error("Le rapport ne peut pas être négatif.");
  }
  return round2(unitStake * rapportPourUnEuro);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
