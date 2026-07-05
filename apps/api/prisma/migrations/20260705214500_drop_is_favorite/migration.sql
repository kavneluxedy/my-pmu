-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Horse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "sex" TEXT,
    "age" INTEGER,
    "discipline" TEXT,
    "usualDriver" TEXT,
    "favHippodrome" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Horse" ("age", "createdAt", "discipline", "favHippodrome", "id", "name", "notes", "sex", "updatedAt", "usualDriver") SELECT "age", "createdAt", "discipline", "favHippodrome", "id", "name", "notes", "sex", "updatedAt", "usualDriver" FROM "Horse";
DROP TABLE "Horse";
ALTER TABLE "new_Horse" RENAME TO "Horse";
CREATE TABLE "new_Runner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "raceId" INTEGER NOT NULL,
    "horseId" INTEGER,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "odds" REAL,
    "estProb" REAL,
    "scratched" BOOLEAN NOT NULL DEFAULT false,
    "arrivalPosition" INTEGER,
    CONSTRAINT "Runner_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Runner_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Runner" ("arrivalPosition", "estProb", "horseId", "id", "name", "number", "odds", "raceId", "scratched") SELECT "arrivalPosition", "estProb", "horseId", "id", "name", "number", "odds", "raceId", "scratched" FROM "Runner";
DROP TABLE "Runner";
ALTER TABLE "new_Runner" RENAME TO "Runner";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
