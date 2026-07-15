import cors from "@fastify/cors";
import Fastify from "fastify";
import { betRoutes } from "./routes/bets.js";
import { horseRoutes } from "./routes/horses.js";
import { pmuRoutes } from "./routes/pmu.js";
import { savedRaceRoutes } from "./routes/savedRaces.js";
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
await app.register(savedRaceRoutes);

const port = Number(process.env.PORT ?? 3001);

// Arrêt gracieux : on ferme Fastify (donc on libère le port) sur chaque signal
// de fin. Sous Windows, Node émet SIGHUP à la fermeture de la fenêtre console,
// SIGINT sur Ctrl+C ; SIGTERM couvre les kill explicites. Sans ça, l'enfant
// lancé par `tsx watch` reste orphelin et garde le port 3001 (« API fantôme »).
let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info(`${signal} reçu, arrêt du serveur…`);
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
