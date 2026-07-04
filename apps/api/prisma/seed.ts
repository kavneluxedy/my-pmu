/** Jeu de données de démonstration : quelques chevaux, paris et transactions. */
import { PrismaClient } from "@prisma/client";
import process from "node:process";

const prisma = new PrismaClient();

async function main() {
  await prisma.horse.createMany({
    data: [
      {
        name: "GALOPIN DU BOIS",
        sex: "H",
        age: 6,
        discipline: "attele",
        usualDriver: "J. Dupont",
        favHippodrome: "Vincennes",
        notes: "Régulier sur 2700m, aime la corde à gauche.",
      },
      {
        name: "IDOLE DE CRENNES",
        sex: "F",
        age: 5,
        discipline: "monte",
        usualDriver: "M. Martin",
        favHippodrome: "Enghien",
      },
    ],
  });

  await prisma.transaction.create({
    data: { date: "2026-06-01", type: "deposit", amount: 200, note: "Dépôt initial" },
  });

  await prisma.bet.createMany({
    data: [
      { date: "2026-06-02", betType: "simple_gagnant", label: "R1C3 - n°7", stake: 10, odds: 3.5, status: "won", payout: 35 },
      { date: "2026-06-03", betType: "couple_place", label: "R2C1 - 4/9", stake: 8, status: "lost", payout: 0 },
      { date: "2026-06-05", betType: "tierce", label: "R1C4 champ 5/8/11 base 2", stake: 6, status: "lost", payout: 0 },
      { date: "2026-06-07", betType: "quinte", label: "R1C1 flexi", stake: 4, odds: 62.4, status: "won", payout: 249.6 },
    ],
  });

  console.log("Seed terminé.");
}

await main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
