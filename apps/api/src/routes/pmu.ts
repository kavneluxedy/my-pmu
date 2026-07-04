import type { FastifyInstance } from "fastify";
import type { ProviderArrival } from "@pmu/engine";
import { z } from "zod";
import { getCitations, getArrival, getProgramme, getRace } from "../pmuCache.js";
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
      return arrival;
    } catch (e) {
      return reply.code(502).send({ error: `Import PMU indisponible : ${(e as Error).message}` });
    }
  });

  app.post("/api/pmu/runner-favorite", async (req, reply) => {
    const bodySchema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ"),
      reunion: z.number(),
      course: z.number(),
      number: z.number(),
      isFavorite: z.boolean(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { date, reunion, course, number, isFavorite } = parsed.data;
    try {
      // Upsert Meeting
      const meeting = await prisma.meeting.upsert({
        where: { date_reunion: { date, reunion } },
        create: { date, reunion, hippodrome: "" },
        update: {},
      });

      // Upsert Race
      const race = await prisma.race.upsert({
        where: { meetingId_course: { meetingId: meeting.id, course } },
        create: { meetingId: meeting.id, course },
        update: {},
      });

      // Pas de contrainte unique sur Runner : findFirst puis create/update
      const existing = await prisma.runner.findFirst({
        where: { raceId: race.id, number },
      });

      if (existing) {
        await prisma.runner.update({
          where: { id: existing.id },
          data: { isFavorite },
        });
      } else {
        await prisma.runner.create({
          data: { raceId: race.id, number, name: "", isFavorite },
        });
      }

      return { success: true };
    } catch (e) {
      return reply.code(500).send({ error: String(e) });
    }
  });
}

/**
 * Persiste l'arrivée en base si la course contient au moins un favori.
 * Favori (décision « les deux ») =
 *   (1) un Runner de cette course déjà marqué isFavorite=true en base, OU
 *   (2) un partant dont le nom matche un Horse avec isFavorite=true (par nom normalisé).
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

  // Critère (1) : un favori déjà persisté sur cette course.
  const meeting = await prisma.meeting.findUnique({
    where: { date_reunion: { date: dateISO, reunion } },
    include: { races: { where: { course }, include: { runners: true } } },
  });
  const dbRace = meeting?.races[0];
  const hasDbFavorite = dbRace?.runners.some((r) => r.isFavorite) ?? false;

  // Critère (2) : un partant correspond à un cheval favori de « Mes chevaux ».
  let hasHorseFavorite = false;
  if (!hasDbFavorite) {
    const favoriteHorses = await prisma.horse.findMany({
      where: { isFavorite: true },
      select: { name: true },
    });
    const favoriteNames = new Set(favoriteHorses.map((h) => normalizeName(h.name)));
    hasHorseFavorite = race.runners.some((r) => favoriteNames.has(normalizeName(r.name)));
  }

  if (!hasDbFavorite && !hasHorseFavorite) return; // Aucun favori : pas de persistance.

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
