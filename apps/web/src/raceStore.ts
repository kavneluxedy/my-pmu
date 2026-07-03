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
  window.dispatchEvent(new CustomEvent(EVENT));
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
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
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
const RACE_REFRESH_MS = 60_000;

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
