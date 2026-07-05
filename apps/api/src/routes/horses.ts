import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const horseSchema = z.object({
  name: z.string().min(1),
  sex: z.string().optional(),
  age: z.number().int().positive().optional(),
  discipline: z.string().optional(),
  usualDriver: z.string().optional(),
  favHippodrome: z.string().optional(),
  notes: z.string().optional(),
});

export async function horseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/horses", async () => prisma.horse.findMany({ orderBy: { name: "asc" } }));

  app.get("/api/horses/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const horse = await prisma.horse.findUnique({ where: { id } });
    if (!horse) return reply.code(404).send({ error: "Cheval introuvable" });
    return horse;
  });

  app.post("/api/horses", async (req, reply) => {
    const parsed = horseSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(await prisma.horse.create({ data: parsed.data }));
  });

  app.put("/api/horses/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const parsed = horseSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return prisma.horse.update({ where: { id }, data: parsed.data });
  });

  app.delete("/api/horses/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    await prisma.horse.delete({ where: { id } });
    return reply.code(204).send();
  });
}
