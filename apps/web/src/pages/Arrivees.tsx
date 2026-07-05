import { useState } from "react";
import { api, type Arrival } from "../api/client.js";
import { CountdownPill } from "../components/CountdownPill.js";
import { useAppClock } from "../hooks/useAppClock.js";
import { countdownStatus } from "../lib/time.js";
import { useProgrammeStore } from "../programmeStore.js";

export default function Arrivees() {
  const programme = useProgrammeStore();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedReunion, setSelectedReunion] = useState<number | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const now = useAppClock();

  let nextKey: string | null = null;
  if (programme) {
    let nextTs = Infinity;
    for (const m of programme.meetings) {
      for (const c of m.races) {
        if (c.startTime != null && c.startTime > now && c.startTime < nextTs) {
          nextTs = c.startTime;
          nextKey = `${m.reunion}-${c.course}`;
        }
      }
    }
  }

  const highlightedStyle = {
    border: "2px solid var(--accent-2)",
    background: "rgba(240,169,59,0.12)",
    color: "var(--text)",
    fontWeight: 700,
  } as const;

  const loadArrival = async (reunion: number, course: number) => {
    setError(null);
    setLoading(true);
    setSelectedReunion(reunion);
    setSelectedCourse(course);
    try {
      const data = await api.arrivee(date, reunion, course);
      setArrival(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggleRunnerFavorite = async (
    runnerName: string,
    currentFavorite: boolean,
  ) => {
    setError(null);
    try {
      await api.setArrivalFavorite(
        runnerName,
        !currentFavorite,
        selectedReunion && selectedCourse ? { date, reunion: selectedReunion, course: selectedCourse } : undefined,
      );
      // Rechargement de l'arrivée après changement du favori.
      if (selectedReunion && selectedCourse) {
        const data = await api.arrivee(date, selectedReunion, selectedCourse);
        setArrival(data);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div>
      <h2>Arrivées des courses</h2>
      <div className="warn">
        Consulte l'ordre d'arrivée définitif des courses. Les arrivées ne sont historisées
        que si la course contient au moins un cheval marqué comme favori.
      </div>

      <div className="panel">
        <div className="form-grid">
          <div className="field">
            <label>Date de la journée<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {programme && (
        <div className="panel">
          <h3>Programme du {programme.date}</h3>
          {programme.meetings.length === 0 && <p className="muted">Aucune réunion trouvée.</p>}
          {programme.meetings.map((m) => (
            <div key={m.reunion} style={{ marginBottom: 16 }}>
              <strong>R{m.reunion} — {m.hippodrome}</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {m.races.map((c) => {
                  const isSelected = selectedReunion === m.reunion && selectedCourse === c.course;
                  const isNext = `${m.reunion}-${c.course}` === nextKey;
                  const isHighlighted = isSelected || isNext;
                  const status = countdownStatus(c.startTime, now, c.departImminent);
                  return (
                    <button
                      key={c.course}
                      className={`secondary${isSelected ? " active" : ""}`}
                      onClick={() => loadArrival(m.reunion, c.course)}
                      disabled={loading}
                      style={isHighlighted ? highlightedStyle : undefined}
                    >
                      {isNext && !isSelected && <span style={{ marginRight: 4 }}>▶</span>}
                      C{c.course}{c.discipline ? ` · ${c.discipline}` : ""}
                      {status && <CountdownPill status={status} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {arrival && (
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>R{arrival.reunion} C{arrival.course} — Arrivée</h3>
            <span className="badge">
              {arrival.definitif ? "✓ Définitif" : "⏳ En attente"}
            </span>
          </div>

          {arrival.ordre.length === 0 ? (
            <p className="muted">Aucune arrivée enregistrée pour cette course.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Position</th>
                  <th>N°</th>
                  <th>Cheval</th>
                  <th>Favori</th>
                </tr>
              </thead>
              <tbody>
                {arrival.ordre.map((runner) => {
                  const rowClass = runner.deadHeat ? "runner-deadheat" : "";
                  return (
                    <tr key={`${runner.position}-${runner.number}`} className={rowClass || undefined}>
                      <td>
                        <strong>{runner.position}{runner.deadHeat ? " (ex-æquo)" : ""}</strong>
                      </td>
                      <td>
                        <span className="runner-num">
                          <span className="runner-num-val">{runner.number}</span>
                        </span>
                      </td>
                      <td>{runner.name ?? "—"}</td>
                      <td>
                        <button
                          className="icon-btn"
                          onClick={() => toggleRunnerFavorite(runner.name ?? "", runner.inFavorites ?? false)}
                          title={runner.inFavorites ? "Retirer des favoris" : "Marquer comme favori"}
                          style={{ cursor: "pointer", padding: "4px 8px", opacity: runner.inFavorites ? 1 : 0.5 }}
                        >
                          ★
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
