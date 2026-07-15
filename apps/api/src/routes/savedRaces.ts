import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const savedRaceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reunion: z.number().int(),
  course: z.number().int(),
  label: z.string().optional(),
  startTime: z.number().int().optional(),
  payload: z.string().min(1), // JSON sérialisé de la ProviderRace (partants + cotes figées)
});

// startTime est stocké en BigInt (epoch ms dépasse la capacité 32 bits d'Int),
// mais BigInt n'est pas sérialisable nativement en JSON : on le reconvertit en
// number avant de renvoyer une SavedRace au client.
function serialize(row: Awaited<ReturnType<typeof prisma.savedRace.upsert>>) {
  return { ...row, startTime: row.startTime != null ? Number(row.startTime) : null };
}

export async function savedRaceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/saved-races", async () => {
    const rows = await prisma.savedRace.findMany({ orderBy: { savedAt: "desc" } });
    return rows.map(serialize);
  });

  app.post("/api/saved-races", async (req, reply) => {
    const parsed = savedRaceSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { date, reunion, course, label, startTime, payload } = parsed.data;
    const startTimeBig = startTime != null ? BigInt(startTime) : undefined;
    // Upsert sur (date, reunion, course) : re-sauvegarder la même course met à
    // jour le snapshot (cotes plus fraîches) plutôt que de créer un doublon.
    const saved = await prisma.savedRace.upsert({
      where: { date_reunion_course: { date, reunion, course } },
      create: { date, reunion, course, label, startTime: startTimeBig, payload },
      update: { label, startTime: startTimeBig, payload, savedAt: new Date() },
    });
    return reply.code(201).send(serialize(saved));
  });

  app.delete("/api/saved-races/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    await prisma.savedRace.delete({ where: { id } });
    return reply.code(204).send();
  });
}
