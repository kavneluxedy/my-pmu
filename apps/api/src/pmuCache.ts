/**
 * Accès aux données PMU via le provider turfinfo, avec cache en base pour
 * limiter les appels réseau (respect des CGU / bonne citoyenneté).
 */
import {
  PmuTurfinfoProvider,
  type ProviderArrival,
  type ProviderCitations,
  type ProviderPlaceReports,
  type ProviderProgramme,
  type ProviderRace,
} from "@pmu/engine";
import { prisma } from "./db.js";

const provider = new PmuTurfinfoProvider();

/**
 * Durées de fraîcheur du cache (ms). Au-delà, on rafraîchit depuis l'API.
 * Programme comme course sont sensibles au temps (heures/imminence de départ et
 * cotes qui bougent en direct) : on garde les deux caches courts.
 */
const TTL_PROGRAMME_MS = 1000 * 30; // 30 s
// Les cotes des partants bougent jusqu'au départ ; on garde le cache court pour
// que le polling du simulateur (~30 s) obtienne des cotes réellement fraîches.
const TTL_RACE_MS = 1000 * 30; // 30 s
// Les enjeux (« citations ») bougent en direct au même rythme que les cotes ;
// on garde un cache court pour des rapports probables réellement frais.
const TTL_CITATIONS_MS = 1000 * 30; // 30 s
// L'arrivée d'une course est définitive et stable une fois connue : cache long.
const TTL_ARRIVAL_MS = 1000 * 60 * 60; // 1 heure
// Les rapports probables (place) changent en direct : cache court.
const TTL_PLACE_REPORTS_MS = 1000 * 30; // 30 s

async function readCache<T>(cacheKey: string, ttlMs: number): Promise<T | null> {
  const row = await prisma.rawPmuSnapshot.findUnique({ where: { cacheKey } });
  if (!row) return null;
  if (Date.now() - row.fetchedAt.getTime() > ttlMs) return null;
  return JSON.parse(row.payload) as T;
}

async function writeCache(cacheKey: string, payload: unknown): Promise<void> {
  const serialized = JSON.stringify(payload);
  await prisma.rawPmuSnapshot.upsert({
    where: { cacheKey },
    create: { cacheKey, payload: serialized },
    update: { payload: serialized, fetchedAt: new Date() },
  });
}

export async function getProgramme(dateISO: string): Promise<ProviderProgramme> {
  const key = `programme:${dateISO}`;
  const cached = await readCache<ProviderProgramme>(key, TTL_PROGRAMME_MS);
  if (cached) return cached;
  const fresh = await provider.getProgramme(dateISO);
  await writeCache(key, fresh);
  return fresh;
}

export async function getRace(
  dateISO: string,
  reunion: number,
  course: number,
): Promise<ProviderRace> {
  const key = `race:${dateISO}:${reunion}:${course}`;
  const cached = await readCache<ProviderRace>(key, TTL_RACE_MS);
  if (cached) return cached;
  const fresh = await provider.getRace(dateISO, reunion, course);
  await writeCache(key, fresh);
  return fresh;
}

export async function getCitations(
  dateISO: string,
  reunion: number,
  course: number,
): Promise<ProviderCitations> {
  const key = `citations:${dateISO}:${reunion}:${course}`;
  const cached = await readCache<ProviderCitations>(key, TTL_CITATIONS_MS);
  if (cached) return cached;
  const fresh = await provider.getCitations(dateISO, reunion, course);
  await writeCache(key, fresh);
  return fresh;
}

export async function getArrival(
  dateISO: string,
  reunion: number,
  course: number,
): Promise<ProviderArrival> {
  const key = `arrivee:${dateISO}:${reunion}:${course}`;
  const cached = await readCache<ProviderArrival>(key, TTL_ARRIVAL_MS);
  if (cached) return cached;
  const fresh = await provider.getArrival(dateISO, reunion, course);
  if (fresh.definitif) await writeCache(key, fresh);
  return fresh;
}

export async function getPlaceReports(
  dateISO: string,
  reunion: number,
  course: number,
): Promise<ProviderPlaceReports> {
  const key = `place-reports:${dateISO}:${reunion}:${course}`;
  const cached = await readCache<ProviderPlaceReports>(key, TTL_PLACE_REPORTS_MS);
  if (cached) return cached;
  const fresh = await provider.getPlaceReports(dateISO, reunion, course);
  await writeCache(key, fresh);
  return fresh;
}
