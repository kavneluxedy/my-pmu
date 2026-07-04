-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Runner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "raceId" INTEGER NOT NULL,
    "horseId" INTEGER,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "odds" REAL,
    "estProb" REAL,
    "scratched" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "arrivalPosition" INTEGER,
    CONSTRAINT "Runner_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Runner_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Runner" ("estProb", "horseId", "id", "name", "number", "odds", "raceId", "scratched") SELECT "estProb", "horseId", "id", "name", "number", "odds", "raceId", "scratched" FROM "Runner";
DROP TABLE "Runner";
ALTER TABLE "new_Runner" RENAME TO "Runner";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
