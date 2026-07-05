import { useCallback, useState } from "react";
import { api, type PlaceReport } from "../api/client.js";
import { getStoredRace } from "../raceStore.js";

export function usePlaceReports() {
  const [reports, setReports] = useState<PlaceReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const s = getStoredRace();
    if (!s) {
      setReports([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.placeReports(s.date, s.race.reunion, s.race.course);
      setReports(data.runners);
    } catch (e) {
      setError(String(e));
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { reports, loading, error, reload };
}