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
  CombinationBetType,
  CombinationMass,
  CoupleGagnantReport,
  OddsProvider,
  PlaceReport,
  ProviderArrival,
  ProviderArrivalRunner,
  ProviderCitations,
  ProviderCombinations,
  ProviderCoupleGagnantReports,
  ProviderPlaceReports,
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

/** Les montants d'enjeux de l'API PMU sont en centimes ; on les ramène en euros. */
function centsToEuros(cents: number): number {
  return Math.round(cents) / 100;
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
  const upper = typePari.toUpperCase();
  // Tolère les deux formes : E_COUPLE_PLACE et COUPLE_PLACE
  const key = upper.startsWith("E_") ? upper : `E_${upper}`;
  return PMU_TYPE_PARI[key];
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
    enjeu: centsToEuros(c1.enjeu),
    ratio: typeof c1.ratio === "number" ? c1.ratio : undefined,
  };
}

/**
 * Regroupe les rapports Couplé Gagnant bruts par paire non ordonnée [min, max]
 * et renvoie la MOYENNE des rapports (et tendances) des 2 ordres listés par le
 * PMU. Ignore toute entrée dont la combinaison n'est pas une paire d'entiers > 0.
 */
export function normalizeCoupleGagnantReports(
  rapports: Array<Record<string, unknown>>,
): CoupleGagnantReport[] {
  const round1 = (x: number): number => Math.round(x * 10) / 10;
  const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

  const groups = new Map<
    string,
    { pair: [number, number]; rapports: number[]; tendances: number[] }
  >();

  for (const r of rapports) {
    const nums = r.numerosParticipant;
    if (!Array.isArray(nums) || nums.length !== 2) continue;
    const a = nums[0] as number;
    const b = nums[1] as number;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) continue;

    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const key = `${lo}-${hi}`;
    const group =
      groups.get(key) ?? { pair: [lo, hi] as [number, number], rapports: [], tendances: [] };
    if (typeof r.rapportDirect === "number") group.rapports.push(r.rapportDirect);
    if (typeof r.tendance === "number") group.tendances.push(r.tendance);
    groups.set(key, group);
  }

  return Array.from(groups.values(), (g) => ({
    pair: g.pair,
    rapportDirect: g.rapports.length > 0 ? round1(mean(g.rapports)) : 0,
    tendance: g.tendances.length > 0 ? round1(mean(g.tendances)) : undefined,
  }));
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
    jockey: extractJockey(),
    trainer: raw.entraineur ? String(raw.entraineur) : undefined,
    scratched: raw.statut === "NON_PARTANT",
  };

  function extractJockey(): string | undefined {
    if (raw.driver) return String(raw.driver);
    if (raw.jockey) return String(raw.jockey);
    return undefined;
  }
}

interface RapportPari {
  typePari: string;
  rapports?: Array<{ combinaison?: string }>;
}

function normalizeArrivalFromRapports(rapports: RapportPari[]): ProviderArrival {
  // Noms réels renvoyés par l'API rapports-definitifs, du plus informatif au moins.
  const PRIORITY = [
    "QUINTE_PLUS", "QUARTE_PLUS",            // courses avec Quinté/Quarté (rare)
    "SUPER_QUATRE",                            // 4 chevaux (format habituel)
    "TIERCE", "TRIO_ORDRE", "TRIO",            // 3 chevaux
    "COUPLE_ORDRE", "COUPLE_GAGNANT",          // 2 chevaux
    "SIMPLE_GAGNANT", "SIMPLE_GAGNANT_INTERNATIONAL",
  ];
  for (const typePari of PRIORITY) {
    const bloc = rapports.find(r => r.typePari === typePari);
    const combinaison = bloc?.rapports?.[0]?.combinaison;
    if (!combinaison) continue;
    const nums = combinaison.split("-").map(Number).filter(n => n > 0);
    if (nums.length === 0) continue;
    const ordre: ProviderArrivalRunner[] = nums.map((num, idx) => ({
      position: idx + 1,
      number: num,
      deadHeat: false,
    }));
    return { reunion: 0, course: 0, ordre, definitif: true };
  }
  return { reunion: 0, course: 0, ordre: [], definitif: false };
}

/**
 * Normalise l'ordre d'arrivée brut du PMU vers ProviderArrival.
 * Le champ `ordreArrivee` du PMU est typiquement un Array<Array<number>> :
 * - index+1 = position classement
 * - un sous-tableau à plusieurs entrées = dead-heat/ex-æquo
 * Cherche dans raw.ordreArrivee, puis raw.rapportsDefinitifs si absent.
 */
export function normalizeArrival(raw: unknown): ProviderArrival {
  if (Array.isArray(raw)) {
    return normalizeArrivalFromRapports(raw as RapportPari[]);
  }
  const obj = raw as Record<string, unknown>;
  const ordreBrut = (obj.ordreArrivee as unknown[]) ?? (obj.rapportsDefinitifs as unknown[]) ?? [];
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
      throw new TypeError("Aucune implémentation de fetch disponible (fournissez fetchImpl).");
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
    const [data, programme] = await Promise.all([
      this.getJson(`/programme/${pmuDate}/R${reunion}/C${course}/participants`) as Promise<{
        participants?: Array<Record<string, unknown>>;
      }>,
      this.getProgramme(dateISO),
    ]);
    const participants = data.participants ?? [];
    const meeting = programme.meetings.find((m) => m.reunion === reunion);
    const raceInfo = meeting?.races.find((r) => r.course === course);
    return {
      reunion,
      course,
      name: raceInfo?.name,
      discipline: raceInfo?.discipline,
      distance: raceInfo?.distance,
      startTime: raceInfo?.startTime,
      runners: participants.map(normalizeRunner),
    };
  }

  /**
   * Récupère les rapports probables placés pour 1 € de chaque partant via
   * l'endpoint rapports/E_SIMPLE_PLACE. Permet le pré-remplissage automatique
   * du champ rapport dans le simulateur de gains (mode « cote », Simple Placé).
   */
  async getPlaceReports(
    dateISO: string,
    reunion: number,
    course: number,
  ): Promise<ProviderPlaceReports> {
    const pmuDate = toPmuDate(dateISO);
    let data: unknown;
    try {
      data = await this.getJson(
        `/programme/${pmuDate}/R${reunion}/C${course}/rapports/E_SIMPLE_PLACE`,
      );
    } catch {
      // API peut renvoyer 204 (vide) ou erreur : renvoyer liste vide
      return { reunion, course, runners: [] };
    }
    const liste = (data as { rapportsParticipant?: Array<Record<string, unknown>> }).rapportsParticipant ?? [];
    const runners: PlaceReport[] = liste
      .map((r) => {
        const numPmu = Number(r.numPmu ?? 0);
        const min = r.minRapportProbable;
        const max = r.maxRapportProbable;
        if (!numPmu || r.statut === "NON_PARTANT") return null;
        if (typeof min !== "number" || typeof max !== "number") return null;
        return { number: numPmu, minRapport: min, maxRapport: max };
      })
      .filter((r): r is PlaceReport => r !== null);
    return { reunion, course, runners };
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
   * Récupère les rapports probables Couplé Gagnant pour les paires gagnantes
   * (endpoint rapports/E_COUPLE_GAGNANT). Le Couplé Gagnant étant non ordonné,
   * l'API liste chaque paire 2 fois (les 2 ordres [a,b] et [b,a]) avec des
   * `rapportDirect` très proches mais parfois différents (gigue/arrondi du tote,
   * ex. 39 vs 40). On regroupe par clé triée [min, max] et on renvoie la MOYENNE
   * des ordres — estimation déterministe et stable, indépendante de l'ordre de
   * la réponse API.
   */
  async getCoupleGagnantReports(
    dateISO: string,
    reunion: number,
    course: number,
  ): Promise<ProviderCoupleGagnantReports> {
    const pmuDate = toPmuDate(dateISO);
    let data: unknown;
    try {
      data = await this.getJson(
        `/programme/${pmuDate}/R${reunion}/C${course}/rapports/E_COUPLE_GAGNANT`,
      );
    } catch {
      // API peut renvoyer 204 (vide) ou erreur : renvoyer liste vide
      return { reunion, course, reports: [] };
    }

    const raw = data as { rapportsParticipant?: Array<Record<string, unknown>> };
    const reports = normalizeCoupleGagnantReports(raw.rapportsParticipant ?? []);
    return { reunion, course, reports };
  }

  /**
   * Récupère les masses (enjeux par combinaison) via l'endpoint combinaisons.
   * Retourne par type de pari (Couplé Gagnant, Couplé Placé, etc.) les paires
   * les plus jouées et le pool total.
   */
  async getCombinations(
    dateISO: string,
    reunion: number,
    course: number,
  ): Promise<ProviderCombinations> {
    const pmuDate = toPmuDate(dateISO);
    let data: unknown;
    try {
      data = await this.getJson(`/programme/${pmuDate}/R${reunion}/C${course}/combinaisons`);
    } catch {
      // API peut renvoyer 204 (vide) ou erreur : renvoyer liste vide
      return { reunion, course, betTypes: [] };
    }

    const raw = data as { combinaisons?: Array<Record<string, unknown>>; updatetime?: number };
    const combinaisonBlocs = raw.combinaisons ?? [];
    let updatetime: number | undefined;

    const betTypes: CombinationBetType[] = combinaisonBlocs.map((bloc) => {
      const rawTypePari = String(bloc.pariType ?? "");
      const betType = mapTypePari(rawTypePari);

      if (typeof bloc.updatetime === "number") {
        updatetime = Math.max(updatetime ?? 0, bloc.updatetime);
      }

      const listeComb = bloc.listeCombinaisons as Array<Record<string, unknown>> | undefined;
      if (!listeComb) {
        return { betType, rawTypePari, totalPool: 0, combinations: [] };
      }

      // Pool = totalEnjeu du bloc (convertir centimes → euros)
      const totalPool = typeof bloc.totalEnjeu === "number" ? centsToEuros(bloc.totalEnjeu) : 0;

      // Combinations = paires (ou simples à 1 numéro) + enjeu de chaque (convertir centimes → euros)
      const combinations: CombinationMass[] = listeComb
        .map((comb) => {
          const pair = comb.combinaison;
          const enjeu = comb.totalEnjeu;
          if (!Array.isArray(pair) || pair.length < 1) return null;
          if (typeof enjeu !== "number" || enjeu <= 0) return null;
          return { pair: pair as number[], enjeu: centsToEuros(enjeu) };
        })
        .filter((c): c is CombinationMass => c !== null);

      return { betType, rawTypePari, totalPool, combinations };
    });

    return { reunion, course, updatetime, betTypes };
  }

  /**
   * Récupère l'ordre d'arrivée définitif d'une course.
   * Course non encore courue ou pas d'arrivée : renvoie une arrivée vide (definitif=false).
   */
  async getArrival(dateISO: string, reunion: number, course: number): Promise<ProviderArrival> {
    const pmuDate = toPmuDate(dateISO);
    let data: unknown;
    try {
      data = await this.getJson(
        `/programme/${pmuDate}/R${reunion}/C${course}/rapports-definitifs`,
      );
    } catch {
      return { reunion, course, ordre: [], definitif: false };
    }
    const a = normalizeArrival(data);

    // Enrichissement des noms : appel participants en parallèle dès qu'on a un ordre non vide.
    if (a.ordre.length > 0) {
      try {
        const raceData = await this.getJson(`/programme/${pmuDate}/R${reunion}/C${course}/participants`) as {
          participants?: Array<Record<string, unknown>>;
        };
        const nameMap = new Map<number, string>();
        for (const p of raceData.participants ?? []) {
          const num = Number(p.numPmu ?? 0);
          if (num > 0 && p.nom) nameMap.set(num, String(p.nom));
        }
        const ordre = a.ordre.map(r => ({ ...r, name: nameMap.get(r.number) }));
        return { ...a, reunion, course, ordre };
      } catch {
        // Participants indisponibles : on renvoie l'ordre sans les noms.
      }
    }

    return { ...a, reunion, course };
  }
}

/**
 * Fusionne les masses « tous canaux » (endpoint combinaisons) dans les blocs
 * Simple des citations (qui ne couvrent que les mises INTERNET). Pour chaque bloc
 * simple_gagnant / simple_place : le pool devient le totalPool tous-canaux, et
 * l'enjeu de chaque partant devient l'enjeu tous-canaux du cheval (combinaison à
 * un seul numéro), avec `ratio` recalculé (part du pool en %). Les blocs non-Simple
 * sont laissés inchangés. Renvoie un nouvel objet (immutabilité).
 */
export function mergeSimpleMassesFromCombinations(
  citations: ProviderCitations,
  combinations: ProviderCombinations,
): ProviderCitations {
  const SIMPLE = new Set(["simple_gagnant", "simple_place"]);
  const betTypes = citations.betTypes.map((block) => {
    if (block.betType == null || !SIMPLE.has(block.betType)) return block;
    const combBlock = combinations.betTypes.find((c) => c.betType === block.betType);
    if (!combBlock) return block;
    const enjeuByNumber = new Map<number, number>();
    for (const comb of combBlock.combinations) {
      if (comb.pair.length === 1) enjeuByNumber.set(comb.pair[0]!, comb.enjeu);
    }
    const totalPool = combBlock.totalPool;
    const runners = block.runners.map((r) => {
      const enjeu = enjeuByNumber.get(r.number);
      if (enjeu == null) return r; // pas d'enjeu tous-canaux pour ce cheval : on garde tel quel
      const ratio = totalPool > 0 ? (enjeu / totalPool) * 100 : 0;
      return { ...r, enjeu, ratio };
    });
    return { ...block, totalPool, runners };
  });
  return { ...citations, betTypes };
}
