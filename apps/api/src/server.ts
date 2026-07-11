import cors from "@fastify/cors";
import Fastify from "fastify";
import { betRoutes } from "./routes/bets.js";
import { horseRoutes } from "./routes/horses.js";
import { pmuRoutes } from "./routes/pmu.js";
import { simRoutes } from "./routes/sim.js";
import { statsRoutes } from "./routes/stats.js";
import { transactionRoutes } from "./routes/transactions.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",") ?? true,
});

app.get("/api/health", async () => ({ status: "ok" }));

await app.register(horseRoutes);
await app.register(betRoutes);
await app.register(transactionRoutes);
await app.register(simRoutes);
await app.register(statsRoutes);
await app.register(pmuRoutes);

const port = Number(process.env.PORT ?? 3002);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
