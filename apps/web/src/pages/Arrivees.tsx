import { useEffect, useState } from "react";
import { api, type Arrival } from "../api/client.js";
import { useProgrammeStore } from "../programmeStore.js";
import { CountdownPill, countdownStatus } from "../components/CountdownPill.js";

export default function Arrivees() {
  const programme = useProgrammeStore();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedReunion, setSelectedReunion] = useState<number | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
    reunion: number,
    course: number,
    runnerNumber: number,
    currentFavorite: boolean,
  ) => {
    setError(null);
    try {
      await api.setRunnerFavorite(date, reunion, course, runnerNumber, !currentFavorite);
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
            <label>Date de la journée</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {programme && (() => {
        let nextKey: string | null = null;
        let nextTs = Infinity;
        for (const m of programme.meetings) {
          for (const c of m.races) {
            if (c.startTime != null && c.startTime > now && c.startTime < nextTs) {
              nextTs = c.startTime;
              nextKey = `${m.reunion}-${c.course}`;
            }
          }
        }
        return (
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
                    const status = countdownStatus(c.startTime, now, c.departImminent);
                    return (
                      <button
                        key={c.course}
                        className={`secondary${isSelected ? " active" : ""}`}
                        onClick={() => loadArrival(m.reunion, c.course)}
                        disabled={loading}
                        style={isSelected ? {
                          border: "2px solid var(--accent-2)",
                          background: "rgba(240,169,59,0.12)",
                          color: "var(--text)",
                          fontWeight: 700,
                        } : isNext ? {
                          border: "2px solid var(--accent-2)",
                          background: "rgba(240,169,59,0.12)",
                          color: "var(--text)",
                          fontWeight: 700,
                        } : undefined}
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
        );
      })()}

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
                          onClick={() => toggleRunnerFavorite(arrival.reunion, arrival.course, runner.number, false)}
                          title="Marquer comme favori"
                          style={{ cursor: "pointer", padding: "4px 8px" }}
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
