/**
 * Accès aux données PMU via le provider turfinfo, avec cache en base pour
 * limiter les appels réseau (respect des CGU / bonne citoyenneté).
 */
import { PmuTurfinfoProvider, type ProviderProgramme, type ProviderRace } from "@pmu/engine";
import { prisma } from "./db.js";

const provider = new PmuTurfinfoProvider();

/**
 * Durées de fraîcheur du cache (ms). Au-delà, on rafraîchit depuis l'API.
 * Le programme porte l'heure de départ (sensible au temps : le PMU réajuste
 * l'imminence du départ en direct), on le garde donc bien plus frais que les
 * partants/cotes d'une course.
 */
const TTL_PROGRAMME_MS = 1000 * 60; // 60 s
const TTL_RACE_MS = 1000 * 60 * 10; // 10 minutes

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
