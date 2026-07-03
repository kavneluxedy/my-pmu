/**
 * Store minimaliste (pas de dépendance externe) pour passer les données d'une
 * course PMU de la page Import vers le Simulateur.
 * Utilise un CustomEvent pour notifier les abonnés React sans contexte global.
 */
import type { ProviderRace } from "./api/client.js";

const EVENT = "pmu:race-loaded";

/** Écrit la course dans le store et notifie les abonnés. */
export function setRaceStore(race: ProviderRace): void {
  sessionStorage.setItem("pmu_race", JSON.stringify(race));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Lit la course stockée (null si absente). */
export function getRaceStore(): ProviderRace | null {
  const raw = sessionStorage.getItem("pmu_race");
  return raw ? (JSON.parse(raw) as ProviderRace) : null;
}

/** Hook React : retourne la course courante et se met à jour quand elle change. */
import { useEffect, useState } from "react";

export function useRaceStore(): ProviderRace | null {
  const [race, setRace] = useState<ProviderRace | null>(getRaceStore);
  useEffect(() => {
    const handler = () => setRace(getRaceStore());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return race;
}
