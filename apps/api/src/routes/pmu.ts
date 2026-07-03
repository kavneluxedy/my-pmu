import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getProgramme, getRace } from "../pmuCache.js";

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
}
