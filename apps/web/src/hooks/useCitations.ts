import { useCallback, useState } from "react";
import { api, type ProviderCitations } from "../api/client.js";
import { getStoredRace } from "../raceStore.js";

export function useCitations() {
  const [citations, setCitations] = useState<ProviderCitations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const s = getStoredRace();
    if (!s) {
      setCitations(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setCitations(await api.citations(s.date, s.race.reunion, s.race.course));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { citations, loading, error, reload };
}