/*
  Warnings:

  - You are about to alter the column `startTime` on the `SavedRace` table. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SavedRace" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "reunion" INTEGER NOT NULL,
    "course" INTEGER NOT NULL,
    "label" TEXT,
    "startTime" BIGINT,
    "payload" TEXT NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SavedRace" ("course", "date", "id", "label", "payload", "reunion", "savedAt", "startTime") SELECT "course", "date", "id", "label", "payload", "reunion", "savedAt", "startTime" FROM "SavedRace";
DROP TABLE "SavedRace";
ALTER TABLE "new_SavedRace" RENAME TO "SavedRace";
CREATE UNIQUE INDEX "SavedRace_date_reunion_course_key" ON "SavedRace"("date", "reunion", "course");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
