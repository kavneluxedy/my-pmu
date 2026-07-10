/**
 * Interface commune aux fournisseurs de cotes/programmes.
 * Permet de basculer entre l'import automatique PMU et la saisie manuelle
 * sans que le reste de l'application ne dépende d'une source précise.
 */
import type { BetType, Discipline } from "../types.js";

export interface ProviderRunner {
  number: number;
  name: string;
  /** Cote décimale de référence (probable/direct), si disponible. */
  odds?: number;
  jockey?: string;
  trainer?: string;
  scratched?: boolean;
}

export interface ProviderRace {
  reunion: number; // R
  course: number; // C
  name?: string;
  discipline?: Discipline;
  distance?: number;
  /** Timestamp epoch (ms) du départ officiel de la course, si disponible. */
  startTime?: number;
  /**
   * Signal « live » du PMU : le départ est imminent (les partants sont sous les
   * ordres du starter). L'heure de départ effective peut alors dépasser
   * `startTime` de quelques minutes ; se fier à ce drapeau plutôt qu'au compte
   * à rebours théorique dans la fenêtre critique.
   */
  departImminent?: boolean;
  /** Types de paris disponibles sur la course (libellés PMU). */
  betTypes?: string[];
  runners: ProviderRunner[];
}

export interface ProviderMeeting {
  reunion: number;
  hippodrome: string;
  races: ProviderRace[];
}

export interface ProviderProgramme {
  date: string; // ISO (AAAA-MM-JJ)
  meetings: ProviderMeeting[];
}

export interface ProviderArrivalRunner {
  position: number;
  number: number;
  name?: string;
  deadHeat?: boolean;
}

export interface ProviderArrival {
  reunion: number;
  course: number;
  ordre: ProviderArrivalRunner[];
  definitif: boolean;
  updatetime?: number;
}

export interface OddsProvider {
  /** Récupère le programme complet d'une journée. */
  getProgramme(dateISO: string): Promise<ProviderProgramme>;
  /** Récupère une course précise avec ses partants et cotes. */
  getRace(dateISO: string, reunion: number, course: number): Promise<ProviderRace>;
  /** Récupère l'ordre d'arrivée définitif d'une course. */
  getArrival(dateISO: string, reunion: number, course: number): Promise<ProviderArrival>;
  /** Récupère les rapports probables placés de chaque partant (E_SIMPLE_PLACE). */
  getPlaceReports(dateISO: string, reunion: number, course: number): Promise<ProviderPlaceReports>;
  /** Récupère les rapports probables Couplé Gagnant de chaque paire (E_COUPLE_GAGNANT). */
  getCoupleGagnantReports(dateISO: string, reunion: number, course: number): Promise<ProviderCoupleGagnantReports>;
  /** Récupère les masses (enjeux) par combinaison de paires (endpoint combinaisons). */
  getCombinations(dateISO: string, reunion: number, course: number): Promise<ProviderCombinations>;
}

/**
 * Enjeu misé sur un cheval pour un type de pari donné, issu de l'endpoint
 * « citations » du PMU (rapports probables / « les + joués »). `enjeu` est un
 * montant absolu et `ratio` sa part en pourcentage sur ce type de pari (les
 * ratios d'un même type de pari somment ~100).
 */
export interface CitationRunner {
  number: number; // numPmu
  name: string;
  /** Non-partant (statut PMU « NON_PARTANT »). Exclu des calculs de masse. */
  scratched?: boolean;
  /** Drapeau PMU « le plus joué » (mise en évidence, non utilisé au calcul). */
  favoris?: boolean;
  /**
   * Enjeu misé sur ce cheval, position 1 du type de pari. Même unité que
   * `totalPool` du bloc : le rapport reconstruit (masse ÷ enjeu) est donc
   * correct quelle que soit l'unité réelle (euros ou centimes), qui s'annule.
   */
  enjeu: number;
  /** Part en % des enjeux (probabilité implicite du marché), si fournie. */
  ratio?: number;
}

/**
 * Bloc « citations » d'un type de pari sur une course (ex. Simple Gagnant),
 * avec la masse totale et l'enjeu de chaque partant.
 */
export interface CitationBetType {
  /** Type de pari normalisé (undefined si le libellé PMU n'est pas mappé). */
  betType?: BetType;
  /** Libellé brut PMU (E_SIMPLE_GAGNANT, …), conservé pour affichage/debug. */
  rawTypePari: string;
  /** true si le PMU marque ce type indisponible (aucun enjeu exploitable). */
  indisponible?: boolean;
  /** Masse totale = somme des enjeux (position 1) des partants non scratched. */
  totalPool: number;
  /** Enjeux par cheval (position 1). */
  runners: CitationRunner[];
}

/** Réponse « citations » normalisée d'une course (par type de pari). */
export interface ProviderCitations {
  reunion: number;
  course: number;
  /** Horodatage (epoch ms) de la dernière mise à jour PMU, si disponible. */
  updatetime?: number;
  betTypes: CitationBetType[];
}

/**
 * Rapport probable placé pour 1 € d'un cheval (endpoint rapports/E_SIMPLE_PLACE).
 * Le PMU fournit une fourchette min/max (le rapport placé dépend des autres
 * chevaux placés) ; on conserve les deux bornes pour laisser l'utilisateur choisir.
 */
export interface PlaceReport {
  number: number;
  minRapport: number;
  maxRapport: number;
}

/** Rapports probables placés de tous les partants d'une course. */
export interface ProviderPlaceReports {
  reunion: number;
  course: number;
  runners: PlaceReport[];
}

/**
 * Rapport probable Couplé Gagnant pour une paire de chevaux.
 * Endpoint rapports/E_COUPLE_GAGNANT du PMU.
 */
export interface CoupleGagnantReport {
  pair: [number, number];
  rapportDirect: number;
  tendance?: number;
}

/** Rapports probables Couplé Gagnant de toutes les paires gagnantes. */
export interface ProviderCoupleGagnantReports {
  reunion: number;
  course: number;
  reports: CoupleGagnantReport[];
}

/**
 * Enjeu misé sur une combinaison de 2 chevaux (paire) pour un type de pari donné.
 * Issu du bloc « combinaisons » du PMU (masses « les plus jouées »).
 */
export interface CombinationMass {
  pair: number[];
  enjeu: number;
}

/**
 * Bloc « combinaisons » d'un type de pari sur une course (ex. Couplé Placé),
 * avec la masse totale et l'enjeu de chaque paire (top ~12 les plus jouées).
 */
export interface CombinationBetType {
  /** Type de pari normalisé (undefined si le libellé PMU n'est pas mappé). */
  betType?: BetType;
  /** Libellé brut PMU (COUPLE_PLACE, …), conservé pour affichage/debug. */
  rawTypePari: string;
  /** Masse totale du pool (somme des enjeux de toutes les combinaisons). */
  totalPool: number;
  /** Combinaisons top jouées (≈12 paires les plus jouées). */
  combinations: CombinationMass[];
}

/** Réponse « combinaisons » normalisée d'une course (par type de pari). */
export interface ProviderCombinations {
  reunion: number;
  course: number;
  /** Horodatage (epoch ms) de la dernière mise à jour PMU, si disponible. */
  updatetime?: number;
  betTypes: CombinationBetType[];
}
