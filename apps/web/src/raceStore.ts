/**
 * Store minimaliste (pas de dépendance externe) pour passer les données d'une
 * course PMU de la page Import vers le Simulateur.
 * Utilise un CustomEvent pour notifier les abonnés React sans contexte global.
 *
 * On mémorise aussi la `date` de la course : elle n'est pas portée par
 * `ProviderRace` mais elle est indispensable pour re-fetcher la course et
 * garder les cotes à jour (polling / bouton d'actualisation).
 */
import { useEffect, useState } from "react";
import { api, type ProviderRace } from "./api/client.js";
import { useProgrammeStore } from "./programmeStore.js";

const EVENT = "pmu:race-loaded";

/** Course stockée + sa date d'origine (nécessaire pour la re-fetcher). */
interface StoredRace {
  date: string;
  race: ProviderRace;
}

/** Écrit la course dans le store et notifie les abonnés. */
export function setRaceStore(race: ProviderRace, date: string): void {
  const stored: StoredRace = { date, race };
  sessionStorage.setItem("pmu_race", JSON.stringify(stored));
  globalThis.dispatchEvent(new CustomEvent(EVENT));
}

/** Lit la course stockée avec sa date (null si absente). */
export function getStoredRace(): StoredRace | null {
  const raw = sessionStorage.getItem("pmu_race");
  return raw ? (JSON.parse(raw) as StoredRace) : null;
}

/** Lit la course stockée (null si absente). */
export function getRaceStore(): ProviderRace | null {
  return getStoredRace()?.race ?? null;
}

/** Hook React : retourne la course courante et se met à jour quand elle change. */
export function useRaceStore(): ProviderRace | null {
  const [race, setRace] = useState<ProviderRace | null>(getRaceStore);
  useEffect(() => {
    const handler = () => setRace(getRaceStore());
    globalThis.addEventListener(EVENT, handler);
    return () => globalThis.removeEventListener(EVENT, handler);
  }, []);
  return race;
}

/**
 * Re-fetch la course actuellement stockée depuis l'API et réécrit le store
 * (donc réémet l'événement, resynchronisant tous les abonnés). No-op s'il n'y a
 * aucune course chargée. Renvoie la course rafraîchie (ou null).
 * Partagé par le polling automatique et le bouton « Actualiser les cotes ».
 */
export async function refreshRace(): Promise<ProviderRace | null> {
  const current = getStoredRace();
  if (!current) return null;
  const { date, race } = current;
  const fresh = await api.course(date, race.reunion, race.course);
  setRaceStore(fresh, date);
  return fresh;
}

/** Intervalle de resynchronisation des cotes de la course (ms). */
const RACE_REFRESH_MS = 30_000;

/**
 * Rafraîchit périodiquement la course chargée en tâche de fond, sans spinner.
 * Sans cela, les cotes des partants sont figées au moment où la course a été
 * envoyée au simulateur. À monter uniquement dans le Simulateur : les cotes
 * n'y sont utiles que là, inutile de solliciter l'API ailleurs.
 * No-op tant qu'aucune course n'est chargée.
 */
export function useRacePolling(): void {
  useEffect(() => {
    const id = setInterval(() => {
      refreshRace().catch(() => {
        // Silencieux : un rafraîchissement raté ne doit pas casser l'UI ;
        // le prochain tick réessaiera.
      });
    }, RACE_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
}

/** Marge avant le départ pour capturer les toutes dernières cotes (ms). */
const REFRESH_BEFORE_START_MS = 10_000;

/**
 * Programme un rafraîchissement unique des cotes ~10 s avant le départ de la
 * course chargée, en complément du polling 30 s : c'est le meilleur instant pour
 * figer les cotes les plus fraîches (elles bougent fort en toute fin de pari).
 *
 * `startTime` (epoch ms absolu) n'est pas porté par la `ProviderRace` du store
 * mais par le programme ; on le récupère via `useProgrammeStore()` en croisant
 * reunion/course (même logique que ImportPmu). Si le PMU recale l'heure de
 * départ (polling programme), l'effet se relance et reprogramme le timer.
 * No-op tant qu'aucune course n'est chargée ou que le départ est déjà à moins de
 * 10 s (le polling 30 s couvre alors le reste).
 */
export function useRaceRefreshBeforeStart(): void {
  const programme = useProgrammeStore();
  const stored = getStoredRace();
  const reunion = stored?.race.reunion;
  const course = stored?.race.course;

  const startTime = programme?.meetings
    .find((m) => m.reunion === reunion)
    ?.races.find((c) => c.course === course)?.startTime;

  useEffect(() => {
    if (reunion == null || course == null || typeof startTime !== "number") return;
    const delay = startTime - Date.now() - REFRESH_BEFORE_START_MS;
    if (delay <= 0) return; // Déjà à moins de 10 s / départ passé : rien à planifier.
    const id = setTimeout(() => {
      // Garde-fou : ne rafraîchir que si la course chargée n'a pas changé entre-temps.
      const current = getStoredRace();
      if (current?.race.reunion === reunion && current?.race.course === course) {
        refreshRace().catch(() => {
          // Silencieux : le polling 30 s réessaiera.
        });
      }
    }, delay);
    return () => clearTimeout(id);
  }, [reunion, course, startTime]);
}
