/*
  Warnings:

  - You are about to drop the `Meeting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Race` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Runner` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `raceId` on the `Bet` table. All the data in the column will be lost.
  - You are about to drop the column `raceId` on the `RawPmuSnapshot` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Meeting_date_reunion_key";

-- DropIndex
DROP INDEX "Race_meetingId_course_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Meeting";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Race";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Runner";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "SavedRace" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "reunion" INTEGER NOT NULL,
    "course" INTEGER NOT NULL,
    "label" TEXT,
    "startTime" INTEGER,
    "payload" TEXT NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "betType" TEXT NOT NULL,
    "label" TEXT,
    "stake" REAL NOT NULL,
    "odds" REAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payout" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Bet" ("betType", "createdAt", "date", "id", "label", "odds", "payout", "stake", "status", "updatedAt") SELECT "betType", "createdAt", "date", "id", "label", "odds", "payout", "stake", "status", "updatedAt" FROM "Bet";
DROP TABLE "Bet";
ALTER TABLE "new_Bet" RENAME TO "Bet";
CREATE TABLE "new_RawPmuSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cacheKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_RawPmuSnapshot" ("cacheKey", "fetchedAt", "id", "payload") SELECT "cacheKey", "fetchedAt", "id", "payload" FROM "RawPmuSnapshot";
DROP TABLE "RawPmuSnapshot";
ALTER TABLE "new_RawPmuSnapshot" RENAME TO "RawPmuSnapshot";
CREATE UNIQUE INDEX "RawPmuSnapshot_cacheKey_key" ON "RawPmuSnapshot"("cacheKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SavedRace_date_reunion_course_key" ON "SavedRace"("date", "reunion", "course");
