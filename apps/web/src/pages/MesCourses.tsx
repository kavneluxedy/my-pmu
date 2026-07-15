import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type ProviderRace, type SavedRace } from "../api/client.js";
import { useSortable } from "../hooks/useSortable.js";
import { setRaceStore } from "../raceStore.js";

/** Ligne aplatie pour l'affichage et le tri (nb partants dérivé du payload). */
interface Row {
  id: number;
  date: string;
  rc: string;
  label: string;
  partants: number;
  savedAt: string;
  reunion: number;
  course: number;
  payload: string;
}

/** Nombre de partants non-scratchés dans un payload de course sauvegardée. */
function countRunners(payload: string): number {
  try {
    const race = JSON.parse(payload) as ProviderRace;
    return race.runners.filter((r) => !r.scratched).length;
  } catch {
    return 0;
  }
}

export default function MesCourses() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState<SavedRace[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = () => api.listSavedRaces().then(setSaved).catch((e) => setError(String(e)));
  useEffect(() => {
    void reload();
  }, []);

  const rows = useMemo<Row[]>(
    () =>
      saved.map((s) => ({
        id: s.id,
        date: s.date,
        rc: `R${s.reunion} C${s.course}`,
        label: s.label ?? "—",
        partants: countRunners(s.payload),
        savedAt: new Date(s.savedAt).toLocaleString("fr-FR"),
        reunion: s.reunion,
        course: s.course,
        payload: s.payload,
      })),
    [saved],
  );
  const { sorted, sort, toggleSort } = useSortable(rows);

  const open = (row: Row) => {
    try {
      const race = JSON.parse(row.payload) as ProviderRace;
      // Rechargement instantané depuis le snapshot figé, sans re-fetch PMU.
      setRaceStore(race, row.date);
      navigate("/simulator");
    } catch (e) {
      setError(`Course illisible : ${String(e)}`);
    }
  };

  const remove = async (id: number) => {
    await api.deleteSavedRace(id);
    void reload();
  };

  const arrow = (key: keyof Row) =>
    sort.key === key ? (sort.direction === "asc" ? " ▲" : " ▼") : "";

  return (
    <div>
      <h2>Mes courses</h2>
      <p className="muted">
        Courses sauvegardées depuis le simulateur : partants et cotes figés au moment de
        l'enregistrement, rechargeables instantanément (sans nouvel appel PMU).
      </p>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        {rows.length === 0 ? (
          <p className="muted">
            Aucune course sauvegardée. Depuis le simulateur, cliquez sur « ★ Sauvegarder ».
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => toggleSort("date")} style={{ cursor: "pointer" }}>Date{arrow("date")}</th>
                <th onClick={() => toggleSort("rc")} style={{ cursor: "pointer" }}>Course{arrow("rc")}</th>
                <th onClick={() => toggleSort("label")} style={{ cursor: "pointer" }}>Libellé{arrow("label")}</th>
                <th onClick={() => toggleSort("partants")} style={{ cursor: "pointer" }}>Partants{arrow("partants")}</th>
                <th onClick={() => toggleSort("savedAt")} style={{ cursor: "pointer" }}>Sauvegardée le{arrow("savedAt")}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.rc}</td>
                  <td>{row.label}</td>
                  <td>{row.partants}</td>
                  <td>{row.savedAt}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="secondary" onClick={() => open(row)}>Ouvrir dans le simulateur →</button>
                    <button className="danger" onClick={() => remove(row.id)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
