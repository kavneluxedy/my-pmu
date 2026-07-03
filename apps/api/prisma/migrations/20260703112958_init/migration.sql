-- CreateTable
CREATE TABLE "Horse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "sex" TEXT,
    "age" INTEGER,
    "discipline" TEXT,
    "usualDriver" TEXT,
    "favHippodrome" TEXT,
    "notes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "reunion" INTEGER NOT NULL,
    "hippodrome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Race" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "meetingId" INTEGER NOT NULL,
    "course" INTEGER NOT NULL,
    "name" TEXT,
    "discipline" TEXT,
    "distance" INTEGER,
    "betTypes" TEXT,
    CONSTRAINT "Race_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Runner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "raceId" INTEGER NOT NULL,
    "horseId" INTEGER,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "odds" REAL,
    "estProb" REAL,
    "scratched" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Runner_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Runner_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "betType" TEXT NOT NULL,
    "label" TEXT,
    "raceId" INTEGER,
    "stake" REAL NOT NULL,
    "odds" REAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payout" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RawPmuSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cacheKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raceId" INTEGER,
    CONSTRAINT "RawPmuSnapshot_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_date_reunion_key" ON "Meeting"("date", "reunion");

-- CreateIndex
CREATE UNIQUE INDEX "Race_meetingId_course_key" ON "Race"("meetingId", "course");

-- CreateIndex
CREATE UNIQUE INDEX "RawPmuSnapshot_cacheKey_key" ON "RawPmuSnapshot"("cacheKey");

-- CreateIndex
CREATE UNIQUE INDEX "RawPmuSnapshot_raceId_key" ON "RawPmuSnapshot"("raceId");
