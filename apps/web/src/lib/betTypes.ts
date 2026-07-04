/**
 * Source unique côté frontend pour les types de paris, leurs libellés lisibles
 * et leur mise minimale (alignée sur pmu.fr). Miroir de `@pmu/engine`
 * (`BET_TYPE_MIN_STAKE`, `BET_TYPE_LABELS`, `BET_TYPES`) : le web ne dépend pas
 * du build de l'engine, on maintient donc ces constantes ici pour toutes les
 * listes déroulantes et validations de mise de l'interface.
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

/** Mise minimale (€) autorisée par type de pari (règles pmu.fr). */
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

/** Libellés lisibles des types de paris (affichage dans les listes). */
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
 * Taux de retour au joueur par type de pari (miroir de `TRJ` de @pmu/engine).
 * Sert à afficher un rapport probable indicatif à partir des enjeux misés
 * (masse × TRJ ÷ enjeu) ; le calcul contractuel reste fait par l'API.
 */
export const TRJ: Record<BetType, number> = {
  simple_gagnant: 0.85,
  simple_place: 0.85,
  couple_gagnant: 0.76,
  couple_place: 0.76,
  couple_ordre: 0.76,
  trio: 0.75,
  tierce: 0.75,
  quarte: 0.74,
  quinte: 0.74,
  multi: 0.68,
  deux_sur_quatre: 0.75,
};

/** Taux de retour au joueur par défaut pour un type de pari donné. */
export function trjFor(betType: BetType): number {
  return TRJ[betType];
}

/** Ordre d'affichage canonique des types de paris. */
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
