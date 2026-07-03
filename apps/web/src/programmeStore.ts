/**
 * Store minimaliste pour le programme PMU de la journée.
 * Même pattern que raceStore : sessionStorage + CustomEvent pour notifier React.
 */
import { useEffect, useState } from "react";
import { api, type ProviderProgramme } from "./api/client.js";

const EVENT = "pmu:programme-loaded";

export function setProgrammeStore(programme: ProviderProgramme): void {
  sessionStorage.setItem("pmu_programme", JSON.stringify(programme));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getProgrammeStore(): ProviderProgramme | null {
  const raw = sessionStorage.getItem("pmu_programme");
  return raw ? (JSON.parse(raw) as ProviderProgramme) : null;
}

export function useProgrammeStore(): ProviderProgramme | null {
  const [programme, setProgramme] = useState<ProviderProgramme | null>(getProgrammeStore);
  useEffect(() => {
    const handler = () => setProgramme(getProgrammeStore());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return programme;
}

/** Intervalle de resynchronisation du programme (ms). */
const REFRESH_MS = 30_000;

/**
 * Rafraîchit périodiquement le programme d'une journée en tâche de fond, sans
 * spinner. Corrige la dérive du compte à rebours : sans cela, `startTime` (et
 * `departImminent`) sont figés au premier chargement et l'utilisateur doit
 * recharger la page pour resynchroniser avec le PMU. Monté une seule fois au
 * niveau App pour couvrir toutes les vues (widget « prochaine course », liste).
 * No-op tant qu'aucun programme n'a été chargé (rien à resynchroniser).
 */
export function useProgrammePolling(): void {
  useEffect(() => {
    const tick = () => {
      const current = getProgrammeStore();
      if (!current) return; // rien à rafraîchir tant qu'aucun programme n'est chargé
      api
        .programme(current.date)
        .then((prog) => setProgrammeStore(prog))
        .catch(() => {
          // Silencieux : un rafraîchissement raté ne doit pas casser l'UI ;
          // le prochain tick réessaiera.
        });
    };
    const id = setInterval(tick, REFRESH_MS);
    return () => clearInterval(id);
  }, []);
}
