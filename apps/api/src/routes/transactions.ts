import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const txSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["deposit", "withdrawal"]),
  amount: z.number().positive(),
  note: z.string().optional(),
});

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/transactions", async () =>
    prisma.transaction.findMany({ orderBy: { date: "desc" } }),
  );

  app.post("/api/transactions", async (req, reply) => {
    const parsed = txSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(await prisma.transaction.create({ data: parsed.data }));
  });

  app.delete("/api/transactions/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    await prisma.transaction.delete({ where: { id } });
    return reply.code(204).send();
  });
}
