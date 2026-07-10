import { useCallback, useState } from "react";
import { api, type CoupleReports } from "../api/client.js";
import { getStoredRace } from "../raceStore.js";

export function useCoupleReports() {
  const [coupleReports, setCoupleReports] = useState<CoupleReports | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const s = getStoredRace();
    if (!s) {
      setCoupleReports(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setCoupleReports(await api.coupleReports(s.date, s.race.reunion, s.race.course));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { coupleReports, loading, error, reload };
}
