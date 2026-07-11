// Tue tout process qui écoute déjà sur le port de l'API avant de démarrer.
// Évite les "API fantômes" (EADDRINUSE) laissées par un ancien `tsx watch`
// mal arrêté (fenêtre fermée, crash IDE, etc.).
import { execSync } from "node:child_process";

const port = Number(process.env.PORT ?? 3001);

// stderr en "ignore" : évite qu'une erreur PowerShell/lsof (déjà gérée par le
// catch ci-dessous) ne pollue la console avec un dump d'erreur au démarrage.
function run(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
}

function findWindowsPids(port) {
  try {
    // powershell.exe peut être absent (poste verrouillé, AppLocker, image
    // Windows minimaliste) : sans try/catch ça plante tout `npm run predev`.
    const out = run(
      `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`,
    );
    return out ? [...new Set(out.split(/\s+/))] : [];
  } catch {
    return [];
  }
}

function findPosixPids(port) {
  try {
    const out = run(`lsof -ti tcp:${port}`);
    return out ? [...new Set(out.split("\n"))] : [];
  } catch {
    return [];
  }
}

const pids = process.platform === "win32" ? findWindowsPids(port) : findPosixPids(port);

for (const pid of pids) {
  try {
    process.kill(Number(pid), "SIGKILL");
    console.log(`[free-port] port ${port} libéré (PID ${pid} arrêté)`);
  } catch {
    // Déjà mort entre la détection et le kill : rien à faire.
  }
}
