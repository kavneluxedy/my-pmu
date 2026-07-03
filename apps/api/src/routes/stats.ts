import { computeBankrollStats, type BetRecord } from "@pmu/engine";
import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/stats/bankroll", async () => {
    const bets = await prisma.bet.findMany({ orderBy: { date: "asc" } });
    const records: BetRecord[] = bets.map((b) => ({
      date: b.date,
      stake: b.stake,
      payout: b.payout,
      status: b.status as BetRecord["status"],
    }));
    return computeBankrollStats(records);
  });
}
