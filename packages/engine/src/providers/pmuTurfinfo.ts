/**
 * Adaptateur pour l'API communautaire non-officielle "turfinfo" du PMU.
 *
 * ⚠️ AVERTISSEMENT : cette API n'est pas un service public officiel documenté.
 * Elle est utilisée à titre personnel. Espacez les requêtes, mettez en cache
 * les réponses (voir la table RawPmuSnapshot côté API) et respectez les CGU du
 * PMU. Ce module isole toute la dépendance à ce flux : si l'API change ou
 * devient indisponible, seule la couche d'import est concernée, la saisie
 * manuelle restant pleinement fonctionnelle.
 *
 * Endpoints de référence (client 61) :
 *   /rest/client/61/programme/{JJMMAAAA}
 *   /rest/client/61/programme/{JJMMAAAA}/R{n}/C{n}/participants
 *   /rest/client/61/programme/{JJMMAAAA}/R{n}/C{n}/rapports-definitifs
 *   /rest/client/61/programme/{JJMMAAAA}/R{n}/C{n}/citations  (enjeux / rapports probables)
 */
import type { BetType, Discipline } from "../types.js";
import type {
  CitationBetType,
  CitationRunner,
  OddsProvider,
  ProviderArrival,
  ProviderArrivalRunner,
  ProviderCitations,
  ProviderProgramme,
  ProviderRace,
  ProviderRunner,
} from "./oddsProvider.js";

const BASE_URL = "https://online.turfinfo.api.pmu.fr/rest/client/61";

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface PmuTurfinfoOptions {
  /** Implémentation de fetch (injectée pour les tests / environnements). */
  fetchImpl?: FetchLike;
  baseUrl?: string;
}

/** Convertit une date ISO (AAAA-MM-JJ) au format PMU JJMMAAAA. */
export function toPmuDate(dateISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) throw new Error(`Date ISO invalide : ${dateISO}`);
  return `${m[3]}${m[2]}${m[1]}`;
}

/** Mappe la spécialité PMU vers notre type Discipline interne. */
export function mapDiscipline(specialite?: string): Discipline | undefined {
  if (!specialite) return undefined;
  const s = specialite.toUpperCase();
  if (s.includes("ATTELE")) return "attele";
  if (s.includes("MONTE")) return "monte";
  if (s.includes("PLAT")) return "plat";
  if (s.includes("HAIE") || s.includes("STEEPLE") || s.includes("OBSTACLE")) return "obstacle";
  if (s.includes("TROT")) return "trot";
  return undefined;
}

/**
 * Correspondance des libellés `typePari` PMU vers nos BetType internes.
 * Seuls les types exploitables par le simulateur de gains sont mappés ; les
 * autres (E_SUPER_QUATRE, E_REPORT_PLUS, …) restent sans BetType (le libellé
 * brut est tout de même conservé côté normalisation).
 */
const PMU_TYPE_PARI: Record<string, BetType> = {
  E_SIMPLE_GAGNANT: "simple_gagnant",
  E_SIMPLE_PLACE: "simple_place",
  E_COUPLE_GAGNANT: "couple_gagnant",
  E_COUPLE_PLACE: "couple_place",
  E_TRIO: "trio",
};

/** Mappe un libellé `typePari` PMU vers notre BetType (undefined si inconnu). */
export function mapTypePari(typePari?: string): BetType | undefined {
  if (!typePari) return undefined;
  return PMU_TYPE_PARI[typePari.toUpperCase()];
}

/**
 * Normalise un participant « citations » brut vers CitationRunner. On ne retient
 * que l'enjeu de POSITION 1 (compatible avec le moteur de masses pour Simple et
 * Couplé) ; les positions > 1 (Super Quatre) sont ignorées. Renvoie null quand
 * aucune citation exploitable (pas d'enjeu numérique) n'est présente.
 */
export function normalizeCitationRunner(
  raw: Record<string, unknown>,
): CitationRunner | null {
  const citations =
    (raw.citations as Array<{ position?: number; enjeu?: number; ratio?: number }>) ?? [];
  const c1 = citations.find((c) => c.position === 1) ?? citations[0];
  if (!c1 || typeof c1.enjeu !== "number") return null;
  return {
    number: Number(raw.numPmu ?? 0),
    name: String(raw.nom ?? ""),
    scratched: raw.statut === "NON_PARTANT",
    favoris: raw.favoris === true,
    enjeu: c1.enjeu,
    ratio: typeof c1.ratio === "number" ? c1.ratio : undefined,
  };
}

/**
 * Extrait une cote décimale d'un participant PMU.
 * Le champ `dernierRapportDirect.rapport` est un rapport pour 1 € ~ cote décimale.
 */
export function extractOdds(participant: Record<string, unknown>): number | undefined {
  const direct = participant.dernierRapportDirect as { rapport?: number } | undefined;
  const ref = participant.dernierRapportReference as { rapport?: number } | undefined;
  const value = direct?.rapport ?? ref?.rapport;
  return typeof value === "number" && value > 0 ? value : undefined;
}

/** Normalise un participant brut PMU vers notre modèle de partant. */
export function normalizeRunner(raw: Record<string, unknown>): ProviderRunner {
  return {
    number: Number(raw.numPmu ?? raw.numero ?? 0),
    name: String(raw.nom ?? ""),
    odds: extractOdds(raw),
    jockey: raw.driver ? String(raw.driver) : raw.jockey ? String(raw.jockey) : undefined,
    trainer: raw.entraineur ? String(raw.entraineur) : undefined,
    scratched: raw.statut === "NON_PARTANT",
  };
}

/**
 * Normalise l'ordre d'arrivée brut du PMU vers ProviderArrival.
 * Le champ `ordreArrivee` du PMU est typiquement un Array<Array<number>> :
 * - index+1 = position classement
 * - un sous-tableau à plusieurs entrées = dead-heat/ex-æquo
 * Cherche dans raw.ordreArrivee, puis raw.rapportsDefinitifs si absent.
 */
export function normalizeArrival(raw: Record<string, unknown>): ProviderArrival {
  const ordreBrut = (raw.ordreArrivee as unknown[]) ?? (raw.rapportsDefinitifs as unknown[]) ?? [];
  const ordre: ProviderArrivalRunner[] = [];
  ordreBrut.forEach((group, idx) => {
    const nums = Array.isArray(group) ? group : [group];
    const deadHeat = nums.length > 1;
    for (const n of nums) {
      const num = typeof n === "object" && n !== null
        ? Number((n as Record<string, unknown>).numPmu ?? (n as Record<string, unknown>).numero ?? 0)
        : Number(n);
      if (num > 0) ordre.push({ position: idx + 1, number: num, deadHeat });
    }
  });
  return { reunion: 0, course: 0, ordre, definitif: ordre.length > 0 };
}

export class PmuTurfinfoProvider implements OddsProvider {
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;

  constructor(options: PmuTurfinfoOptions = {}) {
    const injected = options.fetchImpl;
    const globalFetch = (globalThis as { fetch?: unknown }).fetch;
    if (injected) {
      this.fetchImpl = injected;
    } else if (typeof globalFetch === "function") {
      this.fetchImpl = ((url: string) => (globalFetch as (u: string) => unknown)(url)) as unknown as FetchLike;
    } else {
      throw new Error("Aucune implémentation de fetch disponible (fournissez fetchImpl).");
    }
    this.baseUrl = options.baseUrl ?? BASE_URL;
  }

  private async getJson(path: string): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`);
    if (!res.ok) {
      throw new Error(`Requête PMU échouée (${res.status}) sur ${path}`);
    }
    return res.json();
  }

  async getProgramme(dateISO: string): Promise<ProviderProgramme> {
    const pmuDate = toPmuDate(dateISO);
    const data = (await this.getJson(`/programme/${pmuDate}`)) as {
      programme?: { reunions?: Array<Record<string, unknown>> };
    };
    const reunions = data.programme?.reunions ?? [];
    return {
      date: dateISO,
      meetings: reunions.map((r) => {
        const hippodrome = (r.hippodrome as { libelleCourt?: string; libelleLong?: string }) ?? {};
        const courses = (r.courses as Array<Record<string, unknown>>) ?? [];
        return {
          reunion: Number(r.numOfficiel ?? r.numExterne ?? 0),
          hippodrome: String(hippodrome.libelleLong ?? hippodrome.libelleCourt ?? ""),
          races: courses.map((c) => ({
            reunion: Number(r.numOfficiel ?? 0),
            course: Number(c.numOrdre ?? c.numExterne ?? 0),
            name: c.libelle ? String(c.libelle) : undefined,
            discipline: mapDiscipline(c.specialite as string | undefined),
            distance: typeof c.distance === "number" ? c.distance : undefined,
            startTime: typeof c.heureDepart === "number" ? c.heureDepart : undefined,
            departImminent: c.departImminent === true,
            runners: [], // le programme ne détaille pas les partants ; voir getRace.
          })),
        };
      }),
    };
  }

  async getRace(dateISO: string, reunion: number, course: number): Promise<ProviderRace> {
    const pmuDate = toPmuDate(dateISO);
    const data = (await this.getJson(
      `/programme/${pmuDate}/R${reunion}/C${course}/participants`,
    )) as { participants?: Array<Record<string, unknown>> };
    const participants = data.participants ?? [];
    return {
      reunion,
      course,
      runners: participants.map(normalizeRunner),
    };
  }

  /**
   * Récupère les « citations » d'une course : par type de pari, la masse totale
   * misée et l'enjeu (+ ratio) de chaque cheval. Alimente le mode « masses » du
   * simulateur de gains avec des données réelles (rapports probables).
   */
  async getCitations(
    dateISO: string,
    reunion: number,
    course: number,
  ): Promise<ProviderCitations> {
    const pmuDate = toPmuDate(dateISO);
    const data = (await this.getJson(
      `/programme/${pmuDate}/R${reunion}/C${course}/citations?paris=&specialisation=INTERNET`,
    )) as { listeCitations?: Array<Record<string, unknown>> };
    const liste = data.listeCitations ?? [];

    let updatetime: number | undefined;
    const betTypes: CitationBetType[] = liste.map((el) => {
      const rawTypePari = String(el.typePari ?? "");
      const betType = mapTypePari(rawTypePari);
      if (typeof el.updatetime === "number") {
        updatetime = Math.max(updatetime ?? 0, el.updatetime);
      }

      const participants = el.participants as Array<Record<string, unknown>> | undefined;
      if (el.indisponible === true || !participants) {
        return { betType, rawTypePari, indisponible: true, totalPool: 0, runners: [] };
      }

      const runners = participants
        .map(normalizeCitationRunner)
        .filter((r): r is CitationRunner => r !== null);
      // La masse partageable ne concerne que les partants réels : on exclut les
      // non-partants du total (leurs enjeux sont remboursés, pas redistribués).
      const totalPool = runners
        .filter((r) => !r.scratched)
        .reduce((sum, r) => sum + r.enjeu, 0);
      return { betType, rawTypePari, totalPool, runners };
    });

    return { reunion, course, updatetime, betTypes };
  }

  /**
   * Récupère l'ordre d'arrivée définitif d'une course.
   * Course non encore courue ou pas d'arrivée : renvoie une arrivée vide (definitif=false).
   */
  async getArrival(dateISO: string, reunion: number, course: number): Promise<ProviderArrival> {
    const pmuDate = toPmuDate(dateISO);
    let data: Record<string, unknown>;
    try {
      data = (await this.getJson(
        `/programme/${pmuDate}/R${reunion}/C${course}/rapports-definitifs`,
      )) as Record<string, unknown>;
    } catch {
      // Course non encore courue / pas d'arrivée : ne pas throw, renvoyer vide.
      return { reunion, course, ordre: [], definitif: false };
    }
    const a = normalizeArrival(data);
    return { ...a, reunion, course };
  }
}
