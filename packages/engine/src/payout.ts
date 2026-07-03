/**
 * Prévision du gain potentiel des paris de base (Simple Gagnant, Simple Placé,
 * Couplé Gagnant, Couplé Placé), selon deux modes :
 *
 * - « cote »   : le rapport pour 1 € est connu → gain = mise × rapport.
 * - « masses » : le rapport est reconstruit à partir des sommes misées par cheval
 *                selon la mécanique du pari mutuel (masse − prélèvement, puis
 *                partage entre les combinaisons gagnantes).
 *
 * Rappel : le PMU ne risque jamais ses fonds. La masse à partager provient des
 * enjeux des parieurs, diminuée du prélèvement (1 − TRJ).
 */
import {
  type BetType,
  type CoupleMassesInput,
  minStakeFor,
  type PayoutMode,
  type PayoutResult,
  RAPPORT_MINIMUM,
  type SimpleMassesInput,
  trjFor,
} from "./types.js";

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Arrondi d'un rapport brut au décime inférieur (dizaine de centimes), comme le
 * fait le PMU sur les rapports publiés. L'arrondi inférieur est la convention
 * retenue ici (prudente pour l'estimation de gain).
 */
function roundDecime(x: number): number {
  return Math.floor(x * 10) / 10;
}

/**
 * Nombre de chevaux payés « placés » selon le nombre de partants :
 * 3 places dès 8 partants, 2 places de 4 à 7 partants, aucune sous 4 partants.
 */
export function placesCount(runnersCount: number): number {
  if (runnersCount >= 8) return 3;
  if (runnersCount >= 4) return 2;
  return 0;
}

/**
 * Construit un PayoutResult à partir d'un rapport brut pour 1 € : borne au
 * minimum garanti, arrondit au décime, puis dérive net, gain brut et gain net.
 */
function buildResult(
  betType: BetType,
  mode: PayoutMode,
  unitStake: number,
  rapportBrutBrut: number,
): PayoutResult {
  const rapportBrut = roundDecime(Math.max(rapportBrutBrut, RAPPORT_MINIMUM));
  const grossPayout = round2(unitStake * rapportBrut);
  return {
    betType,
    mode,
    rapportNetPourUnEuro: round2(rapportBrut - 1),
    rapportBrutPourUnEuro: rapportBrut,
    stake: unitStake,
    grossPayout,
    netProfit: round2(grossPayout - unitStake),
    returnOnStake: rapportBrut,
  };
}

/** Valide la mise face au minimum imposé par le type de pari (règle pmu.fr). */
function assertStake(betType: BetType, unitStake: number): void {
  const min = minStakeFor(betType);
  if (unitStake < min) {
    throw new Error(
      `La mise doit être d'au moins ${min} € pour ce type de pari (règle pmu.fr).`,
    );
  }
}

/**
 * Mode « cote » : le rapport brut pour 1 € est connu, le gain est une simple
 * multiplication (gain = mise × rapport). Applique tout de même le minimum
 * garanti et l'arrondi au décime pour cohérence avec le mode « masses ».
 *
 * @throws si le rapport est inférieur à 1 ou si la mise est sous le minimum.
 */
export function payoutFromOdds(
  betType: BetType,
  unitStake: number,
  rapportBrutPourUnEuro: number,
): PayoutResult {
  assertStake(betType, unitStake);
  if (rapportBrutPourUnEuro < 1) {
    throw new Error("Le rapport pour 1 € doit être au moins égal à 1.");
  }
  return buildResult(betType, "cote", unitStake, rapportBrutPourUnEuro);
}

/** Contrôles communs aux calculs de Simple en mode « masses ». */
function assertSimpleMasses(input: SimpleMassesInput): void {
  if (input.totalPool <= 0) {
    throw new Error("La masse totale misée doit être strictement positive.");
  }
  if (input.stakeOnHorse <= 0) {
    throw new Error("L'enjeu sur le cheval doit être strictement positif.");
  }
  if (input.stakeOnHorse > input.totalPool) {
    throw new Error(
      "L'enjeu sur le cheval ne peut pas dépasser la masse totale misée.",
    );
  }
}

/**
 * Simple Gagnant, mode « masses ».
 * Rapport brut/1 € = (masse totale × TRJ) ÷ enjeux sur le cheval gagnant.
 * (La masse partageable est intégralement reversée aux parieurs du gagnant.)
 *
 * @throws si la masse ou l'enjeu est ≤ 0, ou si l'enjeu dépasse la masse.
 */
export function simpleGagnantFromMasses(
  input: SimpleMassesInput,
  unitStake: number,
): PayoutResult {
  assertStake("simple_gagnant", unitStake);
  assertSimpleMasses(input);
  const trj = input.trj ?? trjFor("simple_gagnant");
  const rapportBrut = (input.totalPool * trj) / input.stakeOnHorse;
  return buildResult("simple_gagnant", "masses", unitStake, rapportBrut);
}

/**
 * Simple Placé, mode « masses ».
 * La masse partageable (masse totale × TRJ) est divisée en parts ÉGALES entre
 * les N chevaux placés (N = placesCount) ; la part d'un cheval, rapportée à ses
 * enjeux, donne le rapport brut/1 € = (masse × TRJ ÷ N) ÷ enjeux sur le cheval.
 *
 * APPROXIMATION pédagogique : le règlement rembourse d'abord les mises des
 * chevaux placés (coefficient de réservation = 1) puis partage le solde. La
 * ventilation exacte exige les enjeux de chaque cheval placé (non disponibles) ;
 * on retient donc un partage direct de la masse en parts égales.
 *
 * @throws si moins de 4 partants (aucun placé payé), masse ou enjeu ≤ 0.
 */
export function simplePlaceFromMasses(
  input: SimpleMassesInput,
  unitStake: number,
): PayoutResult {
  assertStake("simple_place", unitStake);
  assertSimpleMasses(input);
  const places = placesCount(input.runnersCount);
  if (places === 0) {
    throw new Error(
      "Aucun placé payé : il faut au moins 4 partants pour un Simple Placé.",
    );
  }
  const trj = input.trj ?? trjFor("simple_place");
  const rapportBrut = (input.totalPool * trj) / places / input.stakeOnHorse;
  return buildResult("simple_place", "masses", unitStake, rapportBrut);
}

/** Contrôles communs aux calculs de Couplé en mode « masses ». */
function assertCoupleMasses(input: CoupleMassesInput): void {
  if (input.totalPool <= 0) {
    throw new Error("La masse totale misée doit être strictement positive.");
  }
  if (input.stakeOnCombination <= 0) {
    throw new Error("L'enjeu sur la combinaison doit être strictement positif.");
  }
  if (input.stakeOnCombination > input.totalPool) {
    throw new Error(
      "L'enjeu sur la combinaison ne peut pas dépasser la masse totale misée.",
    );
  }
}

/**
 * Couplé Gagnant, mode « masses » (trouver les 2 premiers, sans ordre).
 * Rapport brut/1 € = (masse totale × TRJ) ÷ enjeux sur la combinaison gagnante.
 *
 * @throws si la masse ou l'enjeu est ≤ 0.
 */
export function coupleGagnantFromMasses(
  input: CoupleMassesInput,
  unitStake: number,
): PayoutResult {
  assertStake("couple_gagnant", unitStake);
  assertCoupleMasses(input);
  const trj = input.trj ?? trjFor("couple_gagnant");
  const rapportBrut = (input.totalPool * trj) / input.stakeOnCombination;
  return buildResult("couple_gagnant", "masses", unitStake, rapportBrut);
}

/**
 * Couplé Placé, mode « masses » (les 2 chevaux dans les 3 premiers).
 * Trois combinaisons sont gagnantes (1-2, 1-3, 2-3) : elles se partagent la
 * masse partageable à parts égales. Rapport brut/1 € pour une combinaison =
 * (masse totale × TRJ ÷ 3) ÷ enjeux sur cette combinaison.
 *
 * @throws si la masse ou l'enjeu est ≤ 0.
 */
export function couplePlaceFromMasses(
  input: CoupleMassesInput,
  unitStake: number,
): PayoutResult {
  assertStake("couple_place", unitStake);
  assertCoupleMasses(input);
  const trj = input.trj ?? trjFor("couple_place");
  const rapportBrut = (input.totalPool * trj) / 3 / input.stakeOnCombination;
  return buildResult("couple_place", "masses", unitStake, rapportBrut);
}

/** Types de paris couverts par la façade de prévision de gain. */
export type PayoutBetType =
  | "simple_gagnant"
  | "simple_place"
  | "couple_gagnant"
  | "couple_place";

/** Requête unifiée de prévision de gain (simplifie le câblage API). */
export interface PayoutRequest {
  betType: PayoutBetType;
  unitStake: number;
  mode: PayoutMode;
  /** Requis en mode « cote ». */
  rapportBrutPourUnEuro?: number;
  /** Requis en mode « masses » (forme Simple ou Couplé selon le betType). */
  masses?: SimpleMassesInput | CoupleMassesInput;
}

/**
 * Façade : route vers le bon calcul selon le type de pari et le mode. Sert de
 * point d'entrée unique à la route API.
 *
 * @throws si les données requises par le mode sont absentes.
 */
export function computePayout(req: PayoutRequest): PayoutResult {
  const { betType, unitStake, mode } = req;

  if (mode === "cote") {
    if (req.rapportBrutPourUnEuro == null) {
      throw new Error("Mode « cote » : le rapport pour 1 € est requis.");
    }
    return payoutFromOdds(betType, unitStake, req.rapportBrutPourUnEuro);
  }

  if (req.masses == null) {
    throw new Error("Mode « masses » : les enjeux misés sont requis.");
  }

  switch (betType) {
    case "simple_gagnant":
      return simpleGagnantFromMasses(req.masses as SimpleMassesInput, unitStake);
    case "simple_place":
      return simplePlaceFromMasses(req.masses as SimpleMassesInput, unitStake);
    case "couple_gagnant":
      return coupleGagnantFromMasses(req.masses as CoupleMassesInput, unitStake);
    case "couple_place":
      return couplePlaceFromMasses(req.masses as CoupleMassesInput, unitStake);
  }
}
