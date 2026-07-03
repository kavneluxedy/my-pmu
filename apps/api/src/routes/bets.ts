import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const betSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  betType: z.string().min(1),
  label: z.string().optional(),
  raceId: z.number().int().optional(),
  stake: z.number().positive(),
  odds: z.number().positive().optional(),
  status: z.enum(["pending", "won", "lost"]).optional(),
  payout: z.number().nonnegative().optional(),
});

export async function betRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/bets", async (req) => {
    const { status } = req.query as { status?: string };
    return prisma.bet.findMany({
      where: status ? { status } : undefined,
      orderBy: { date: "desc" },
    });
  });

  app.post("/api/bets", async (req, reply) => {
    const parsed = betSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(await prisma.bet.create({ data: parsed.data }));
  });

  app.put("/api/bets/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const parsed = betSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return prisma.bet.update({ where: { id }, data: parsed.data });
  });

  app.delete("/api/bets/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    await prisma.bet.delete({ where: { id } });
    return reply.code(204).send();
  });
}
