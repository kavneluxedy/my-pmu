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
 */
import type { Discipline } from "../types.js";
import type {
  OddsProvider,
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
}
