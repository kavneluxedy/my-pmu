import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

// Charge apps/api/.env de façon indépendante du cwd. Prisma lit normalement le
// .env automatiquement, mais uniquement relativement au répertoire de lancement
// du process : si l'API démarre depuis un autre dossier (racine du monorepo,
// worktree, script), DATABASE_URL reste introuvable et Prisma échoue à l'init.
// On résout donc le .env par rapport à CE module (apps/api/src → apps/api) et on
// n'écrase jamais une variable déjà présente dans l'environnement réel.
function loadEnvFromApiRoot(): void {
  const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let raw: string;
  try {
    raw = readFileSync(resolve(apiRoot, ".env"), "utf8");
  } catch {
    return; // pas de .env (ex: prod avec variables déjà injectées) : on ignore.
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFromApiRoot();

/** Client Prisma unique, partagé par toutes les routes. */
export const prisma = new PrismaClient();
