import type { FastifyInstance } from "fastify";
import type { ProviderArrival } from "@pmu/engine";
import { z } from "zod";
import { getCitations, getArrival, getPlaceReports, getProgramme, getRace } from "../pmuCache.js";
import { prisma } from "../db.js";

/** Normalise un nom de cheval pour comparaison (favoris « Mes chevaux »). */
function normalizeName(name: string): string {
  return name.trim().toUpperCase();
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

export async function pmuRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/pmu/programme", async (req, reply) => {
    const parsed = dateSchema.safeParse((req.query as { date?: string }).date);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return await getProgramme(parsed.data);
    } catch (e) {
      return reply.code(502).send({ error: `Import PMU indisponible : ${(e as Error).message}` });
    }
  });

  app.get("/api/pmu/course/:date/:reunion/:course", async (req, reply) => {
    const p = req.params as { date: string; reunion: string; course: string };
    const parsed = dateSchema.safeParse(p.date);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return await getRace(parsed.data, Number(p.reunion), Number(p.course));
    } catch (e) {
      return reply.code(502).send({ error: `Import PMU indisponible : ${(e as Error).message}` });
    }
  });

  app.get("/api/pmu/citations/:date/:reunion/:course", async (req, reply) => {
    const p = req.params as { date: string; reunion: string; course: string };
    const parsed = dateSchema.safeParse(p.date);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return await getCitations(parsed.data, Number(p.reunion), Number(p.course));
    } catch (e) {
      return reply.code(502).send({ error: `Import PMU indisponible : ${(e as Error).message}` });
    }
  });

  app.get("/api/pmu/place-reports/:date/:reunion/:course", async (req, reply) => {
    const p = req.params as { date: string; reunion: string; course: string };
    const parsed = dateSchema.safeParse(p.date);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return await getPlaceReports(parsed.data, Number(p.reunion), Number(p.course));
    } catch (e) {
      return reply.code(502).send({ error: `Import PMU indisponible : ${(e as Error).message}` });
    }
  });

  app.get("/api/pmu/arrivee/:date/:reunion/:course", async (req, reply) => {
    const p = req.params as { date: string; reunion: string; course: string };
    const parsed = dateSchema.safeParse(p.date);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const arrival = await getArrival(parsed.data, Number(p.reunion), Number(p.course));
      // Persistance conditionnelle si arrivée définitive.
      if (arrival.definitif) {
        await persistArrivalIfFavorite(parsed.data, Number(p.reunion), Number(p.course), arrival);
      }
      // Enrichir chaque partant avec inFavorites (booléen indiquant si ce cheval est dans « Mes chevaux »).
      const favoriteNames = await favoriteHorseNames();
      const enriched = {
        ...arrival,
        ordre: arrival.ordre.map((r) => ({
          ...r,
          inFavorites: r.name != null && favoriteNames.has(normalizeName(r.name)),
        })),
      };
      return enriched;
    } catch (e) {
      return reply.code(502).send({ error: `Import PMU indisponible : ${(e as Error).message}` });
    }
  });

  app.post("/api/pmu/arrival-favorite", async (req, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1),
      add: z.boolean(),
      date: dateSchema.optional(),
      reunion: z.number().int().optional(),
      course: z.number().int().optional(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { name, add, date, reunion, course } = parsed.data;
    try {
      const normalized = normalizeName(name);
      const match =
        (await prisma.horse.findMany()).find((h) => normalizeName(h.name) === normalized) ?? null;

      // Retrait : supprimer le Horse s'il existe.
      if (!add) {
        if (match) await prisma.horse.delete({ where: { id: match.id } });
        return { success: true };
      }

      // Ajout : enrichissement best-effort depuis le contexte course.
      let enriched: { usualDriver?: string; discipline?: string; favHippodrome?: string; notes?: string } = {};
      if (date != null && reunion != null && course != null) {
        try {
          const [race, programme] = await Promise.all([
            getRace(date, reunion, course),
            getProgramme(date),
          ]);
          const partant = race.runners.find((r) => normalizeName(r.name) === normalized);
          const meeting = programme.meetings.find((m) => m.reunion === reunion);
          const raceInfo = meeting?.races.find((c) => c.course === course);
          enriched = {
            usualDriver: partant?.jockey ?? undefined,
            discipline: raceInfo?.discipline ?? undefined,
            favHippodrome: meeting?.hippodrome || undefined,
            notes: `Ajouté depuis R${reunion}C${course} du ${date}`,
          };
        } catch {
          // Enrichissement indisponible (réseau) : on crée quand même avec le nom seul.
        }
      }

      if (!match) {
        await prisma.horse.create({
          data: {
            name: name.trim(),
            usualDriver: enriched.usualDriver,
            discipline: enriched.discipline,
            favHippodrome: enriched.favHippodrome,
            notes: enriched.notes,
          },
        });
      } else {
        // Compléter uniquement les champs actuellement vides (ne pas écraser une saisie manuelle).
        const data: Record<string, string> = {};
        if (!match.usualDriver && enriched.usualDriver) data.usualDriver = enriched.usualDriver;
        if (!match.discipline && enriched.discipline) data.discipline = enriched.discipline;
        if (!match.favHippodrome && enriched.favHippodrome) data.favHippodrome = enriched.favHippodrome;
        if (!match.notes && enriched.notes) data.notes = enriched.notes;
        if (Object.keys(data).length > 0) {
          await prisma.horse.update({ where: { id: match.id }, data });
        }
      }

      return { success: true };
    } catch (e) {
      return reply.code(500).send({ error: String(e) });
    }
  });
}

/** Récupère les noms normalisés de tous les chevaux favoris (« Mes chevaux »). */
async function favoriteHorseNames(): Promise<Set<string>> {
  const favoriteHorses = await prisma.horse.findMany({ select: { name: true } });
  return new Set(favoriteHorses.map((h) => normalizeName(h.name)));
}

/**
 * Persiste l'arrivée en base si la course contient au moins un favori.
 * Favori (décision « les deux ») =
 *   (1) un Runner de cette course sans cheval lié (legacy), OU
 *   (2) un partant dont le nom matche un Horse existant (par nom normalisé).
 * Dans ce cas, on upsert Meeting/Race puis chaque partant classé avec sa position
 * d'arrivée. Sinon, on ne persiste rien (l'arrivée reste seulement affichée/cachée).
 */
async function persistArrivalIfFavorite(
  dateISO: string,
  reunion: number,
  course: number,
  arrival: ProviderArrival,
): Promise<void> {
  // Partants réels (noms + numéros) : l'arrivée PMU ne fournit que des numéros.
  let race;
  try {
    race = await getRace(dateISO, reunion, course);
  } catch {
    return; // Sans les partants, on ne peut ni matcher les noms ni nommer les Runners.
  }
  const runnersByNumber = new Map(race.runners.map((r) => [r.number, r]));

  // Critère : un partant correspond à un cheval de « Mes chevaux ».
  const favoriteHorses = await prisma.horse.findMany({ select: { name: true } });
  const favoriteNames = new Set(favoriteHorses.map((h) => normalizeName(h.name)));
  const hasHorseFavorite = race.runners.some((r) => favoriteNames.has(normalizeName(r.name)));

  if (!hasHorseFavorite) return; // Aucun favori : pas de persistance.

  // Upsert Meeting/Race pour garantir leur existence.
  const meetingRow = await prisma.meeting.upsert({
    where: { date_reunion: { date: dateISO, reunion } },
    create: { date: dateISO, reunion, hippodrome: "" },
    update: {},
  });
  const raceRow = await prisma.race.upsert({
    where: { meetingId_course: { meetingId: meetingRow.id, course } },
    create: { meetingId: meetingRow.id, course },
    update: {},
  });

  // Upsert chaque partant classé avec sa position d'arrivée.
  const existingRunners = await prisma.runner.findMany({ where: { raceId: raceRow.id } });
  const existingByNumber = new Map(existingRunners.map((r) => [r.number, r]));
  for (const arrivalRunner of arrival.ordre) {
    const providerRunner = runnersByNumber.get(arrivalRunner.number);
    const name = providerRunner?.name ?? "";
    const existing = existingByNumber.get(arrivalRunner.number);
    if (existing) {
      await prisma.runner.update({
        where: { id: existing.id },
        data: { arrivalPosition: arrivalRunner.position, ...(name ? { name } : {}) },
      });
    } else {
      await prisma.runner.create({
        data: { raceId: raceRow.id, number: arrivalRunner.number, name, arrivalPosition: arrivalRunner.position },
      });
    }
  }
}
