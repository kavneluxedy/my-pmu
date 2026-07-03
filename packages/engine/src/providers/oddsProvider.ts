/**
 * Interface commune aux fournisseurs de cotes/programmes.
 * Permet de basculer entre l'import automatique PMU et la saisie manuelle
 * sans que le reste de l'application ne dépende d'une source précise.
 */
import type { Discipline } from "../types.js";

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

export interface OddsProvider {
  /** Récupère le programme complet d'une journée. */
  getProgramme(dateISO: string): Promise<ProviderProgramme>;
  /** Récupère une course précise avec ses partants et cotes. */
  getRace(dateISO: string, reunion: number, course: number): Promise<ProviderRace>;
}
