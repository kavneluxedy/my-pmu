import type { FastifyInstance } from "fastify";
import { mergeSimpleMassesFromCombinations } from "@pmu/engine";
import { z } from "zod";
import { getCitations, getArrival, getPlaceReports, getProgramme, getRace, getCoupleGagnantReports, getCombinations } from "../pmuCache.js";
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
      const [citations, combinations] = await Promise.all([
        getCitations(parsed.data, Number(p.reunion), Number(p.course)),
        getCombinations(parsed.data, Number(p.reunion), Number(p.course)),
      ]);
      return mergeSimpleMassesFromCombinations(citations, combinations);
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

  app.get("/api/pmu/couple-reports/:date/:reunion/:course", async (req, reply) => {
    const p = req.params as { date: string; reunion: string; course: string };
    const parsed = dateSchema.safeParse(p.date);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const [coupleGagnantReports, combinations] = await Promise.all([
        getCoupleGagnantReports(parsed.data, Number(p.reunion), Number(p.course)),
        getCombinations(parsed.data, Number(p.reunion), Number(p.course)),
      ]);

      // Extraire le bloc Couplé Placé des combinaisons
      const placeMassesBlock = combinations.betTypes.find(
        (bt) => bt.betType === "couple_place"
      );

      return {
        reunion: coupleGagnantReports.reunion,
        course: coupleGagnantReports.course,
        gagnant: coupleGagnantReports.reports,
        placeMasses: placeMassesBlock
          ? {
              totalPool: placeMassesBlock.totalPool,
              combinations: placeMassesBlock.combinations,
            }
          : { totalPool: 0, combinations: [] },
      };
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
