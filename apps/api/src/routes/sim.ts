/**
 * Routes de simulation : elles délèguent tous les calculs au moteur @pmu/engine
 * (aucun état, pas d'accès base de données).
 */
import {
  analyzeValueBet,
  computePayout,
  dutchByBudget,
  dutchByTargetProfit,
  type BetType,
  type PayoutRequest,
} from "@pmu/engine";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

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
  betType: z.string().optional(),
});

const payoutSchema = z
  .object({
    betType: z.enum([
      "simple_gagnant",
      "simple_place",
      "couple_gagnant",
      "couple_place",
    ]),
    unitStake: z.number().positive(),
    mode: z.enum(["cote", "masses"]),
    rapportBrutPourUnEuro: z.number().min(1).optional(),
    masses: z
      .object({
        totalPool: z.number().positive(),
        stakeOnHorse: z.number().positive().optional(),
        stakeOnCombination: z.number().positive().optional(),
        runnersCount: z.number().int().positive().optional(),
        trj: z.number().min(0).max(1).optional(),
      })
      .optional(),
  })
  .refine((d) => d.mode !== "cote" || d.rapportBrutPourUnEuro != null, {
    message: "Le rapport pour 1 € est requis en mode « cote ».",
    path: ["rapportBrutPourUnEuro"],
  })
  .refine((d) => d.mode !== "masses" || d.masses != null, {
    message: "Les enjeux misés sont requis en mode « masses ».",
    path: ["masses"],
  })
  .refine(
    (d) =>
      d.mode !== "masses" ||
      d.betType !== "simple_place" ||
      d.masses?.runnersCount != null,
    {
      message: "Le nombre de partants est requis pour un Simple Placé en mode « masses ».",
      path: ["masses", "runnersCount"],
    },
  );

export async function simRoutes(app: FastifyInstance): Promise<void> {
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
      const { betType, ...rest } = parsed.data;
      return analyzeValueBet({ ...rest, betType: betType as BetType | undefined });
    } catch (e) {
      return reply.code(422).send({ error: (e as Error).message });
    }
  });

  app.post("/api/sim/payout", async (req, reply) => {
    const parsed = payoutSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      // Le schéma partage un seul objet `masses` (champs Simple ou Couplé) ; le
      // moteur valide ensuite les champs réellement requis par le type de pari.
      return computePayout(parsed.data as PayoutRequest);
    } catch (e) {
      return reply.code(422).send({ error: (e as Error).message });
    }
  });
}
