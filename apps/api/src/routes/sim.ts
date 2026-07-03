/**
 * Routes de simulation : elles délèguent tous les calculs au moteur @pmu/engine
 * (aucun état, pas d'accès base de données).
 */
import {
  analyzeValueBet,
  computeTicketCost,
  dutchByBudget,
  dutchByTargetProfit,
  type BetType,
} from "@pmu/engine";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const ticketSchema = z.object({
  betType: z.string(),
  selection: z.object({
    bases: z.array(z.number().int()).optional(),
    associated: z.array(z.number().int()).min(1),
    ordered: z.boolean().optional(),
  }),
  unitStake: z.number().positive(),
});

const dutchingSchema = z.object({
  selections: z
    .array(z.object({ selection: z.union([z.number(), z.string()]), odds: z.number().gt(1) }))
    .min(2),
  mode: z.enum(["budget", "target"]),
  amount: z.number().positive(),
});

const valueBetSchema = z.object({
  odds: z.number().gt(1),
  estimatedProbability: z.number().min(0).max(1),
  stake: z.number().positive().optional(),
  bankroll: z.number().nonnegative().optional(),
  kellyFraction: z.number().min(0).max(1).optional(),
  edgeThreshold: z.number().optional(),
});

export async function simRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/sim/ticket", async (req, reply) => {
    const parsed = ticketSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const { betType, selection, unitStake } = parsed.data;
      return computeTicketCost(betType as BetType, selection, unitStake);
    } catch (e) {
      return reply.code(422).send({ error: (e as Error).message });
    }
  });

  app.post("/api/sim/dutching", async (req, reply) => {
    const parsed = dutchingSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const { selections, mode, amount } = parsed.data;
      return mode === "budget"
        ? dutchByBudget({ selections }, amount)
        : dutchByTargetProfit({ selections }, amount);
    } catch (e) {
      return reply.code(422).send({ error: (e as Error).message });
    }
  });

  app.post("/api/sim/valuebet", async (req, reply) => {
    const parsed = valueBetSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return analyzeValueBet(parsed.data);
    } catch (e) {
      return reply.code(422).send({ error: (e as Error).message });
    }
  });
}
