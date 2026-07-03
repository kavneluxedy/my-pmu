/**
 * Types partagés du moteur de calcul, réutilisés par l'API et le frontend.
 * Aucune dépendance externe : ce module reste du TypeScript pur et testable.
 */

/** Disciplines des courses hippiques françaises. */
export type Discipline = "attele" | "monte" | "plat" | "obstacle" | "trot";

/**
 * Types de paris supportés par le simulateur de tickets.
 * Les libellés suivent la nomenclature PMU.
 */
export type BetType =
  | "simple_gagnant"
  | "simple_place"
  | "couple_gagnant"
  | "couple_place"
  | "couple_ordre"
  | "trio"
  | "tierce"
  | "quarte"
  | "quinte"
  | "multi"
  | "deux_sur_quatre";

/** Nombre de chevaux à trouver (dans l'ordre) pour chaque type de pari. */
export const BET_TYPE_POSITIONS: Record<BetType, number> = {
  simple_gagnant: 1,
  simple_place: 1,
  couple_gagnant: 2,
  couple_place: 2,
  couple_ordre: 2,
  trio: 3,
  tierce: 3,
  quarte: 4,
  quinte: 5,
  multi: 4,
  // « 2 sur 4 » : on désigne 2 chevaux qui doivent figurer dans les 4 premiers.
  deux_sur_quatre: 2,
};

/** Indique si le type de pari exige l'ordre exact d'arrivée. */
export const BET_TYPE_ORDERED: Record<BetType, boolean> = {
  simple_gagnant: false,
  simple_place: false,
  couple_gagnant: false,
  couple_place: false,
  couple_ordre: true,
  trio: false,
  tierce: false, // le tiercé « désordre » ; l'ordre est géré via l'option `ordered`
  quarte: false,
  quinte: false,
  multi: false,
  deux_sur_quatre: false,
};

/**
 * Mise minimale (€) autorisée par type de pari, alignée sur les seuils pmu.fr.
 * Sert de borne basse à la saisie de mise (tickets combinés, value bet).
 */
export const BET_TYPE_MIN_STAKE: Record<BetType, number> = {
  simple_gagnant: 2,
  simple_place: 2,
  couple_gagnant: 2,
  couple_place: 2,
  couple_ordre: 2,
  trio: 2,
  tierce: 1,
  quarte: 1.5,
  quinte: 2,
  multi: 3,
  deux_sur_quatre: 3,
};

/** Mise minimale autorisée pour un type de pari donné. */
export function minStakeFor(betType: BetType): number {
  return BET_TYPE_MIN_STAKE[betType];
}

/** Libellés lisibles des types de paris (pour l'affichage dans les listes). */
export const BET_TYPE_LABELS: Record<BetType, string> = {
  simple_gagnant: "Simple gagnant",
  simple_place: "Simple placé",
  couple_gagnant: "Couplé gagnant",
  couple_place: "Couplé placé",
  couple_ordre: "Couplé ordre",
  trio: "Trio",
  tierce: "Tiercé",
  quarte: "Quarté+",
  quinte: "Quinté+",
  multi: "Multi",
  deux_sur_quatre: "2 sur 4",
};

/**
 * Ordre d'affichage canonique des types de paris.
 * Source unique réutilisée par toutes les listes déroulantes du frontend.
 */
export const BET_TYPES: BetType[] = [
  "simple_gagnant",
  "simple_place",
  "couple_gagnant",
  "couple_place",
  "couple_ordre",
  "deux_sur_quatre",
  "trio",
  "tierce",
  "quarte",
  "quinte",
  "multi",
];

/** Sélection de chevaux pour un ticket combiné (numéros de partants). */
export interface TicketSelection {
  /**
   * Chevaux « de base » obligatoirement présents dans chaque combinaison jouée.
   * Vide = pas de base imposée (champ total sur `associated`).
   */
  bases?: number[];
  /** Chevaux associés (champ) parmi lesquels compléter les combinaisons. */
  associated: number[];
  /** Jouer aussi la version « ordre » (multiplie le coût). */
  ordered?: boolean;
}

/** Résultat d'un calcul de coût de ticket. */
export interface TicketCost {
  betType: BetType;
  combinations: number;
  unitStake: number;
  totalCost: number;
}

/** Une ligne de mise proposée par le dutching. */
export interface DutchingLeg {
  /** Identifiant du partant (numéro ou nom). */
  selection: number | string;
  odds: number;
  stake: number;
  /** Retour brut si ce partant gagne (mise × cote). */
  grossReturn: number;
}

/** Résultat complet d'un calcul de dutching. */
export interface DutchingResult {
  legs: DutchingLeg[];
  totalStake: number;
  /** Retour brut garanti (identique quel que soit le gagnant sélectionné). */
  guaranteedReturn: number;
  /** Profit net garanti = guaranteedReturn - totalStake. */
  guaranteedProfit: number;
  /** Somme des probabilités implicites (>1 = pas d'arbitrage possible). */
  impliedProbabilitySum: number;
  /** true si un profit sans risque existe sur la sélection (arbitrage). */
  isArbitrage: boolean;
}

/** Résultat d'une analyse de value bet sur un pari. */
export interface ValueBetResult {
  odds: number;
  /** Probabilité implicite brute dérivée de la cote (1/cote). */
  impliedProbability: number;
  /** Probabilité estimée par l'utilisateur (0..1). */
  estimatedProbability: number;
  /** Espérance de gain nette pour la mise donnée. */
  expectedValue: number;
  /** EV rapportée à la mise (edge). >0 = pari à valeur. */
  edge: number;
  isValueBet: boolean;
  /** Mise conseillée selon Kelly fractionné (peut être 0). */
  kellyStake: number;
}

/** Un pari enregistré, utilisé pour les statistiques de bankroll. */
export interface BetRecord {
  date: string; // ISO 8601
  stake: number;
  /** Gain brut encaissé (0 si perdu, null si en attente). */
  payout: number | null;
  status: "pending" | "won" | "lost";
}

/** Statistiques agrégées de bankroll. */
export interface BankrollStats {
  totalStaked: number;
  totalReturned: number;
  netProfit: number;
  /** ROI = profit net / total misé. */
  roi: number;
  settledBets: number;
  wonBets: number;
  hitRate: number;
  /** Courbe de solde cumulé, un point par pari réglé, trié par date. */
  balanceCurve: { date: string; balance: number }[];
}
