import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type ProviderRace } from "../api/client.js";
import { CountdownPill } from "../components/CountdownPill.js";
import { useAppClock } from "../hooks/useAppClock.js";
import { useSortable } from "../hooks/useSortable.js";
import { countdownStatus } from "../lib/time.js";
import { setProgrammeStore, useProgrammeStore } from "../programmeStore.js";
import { setRaceStore } from "../raceStore.js";

export default function ImportPmu() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  // Le programme vit dans le store partagé : il est rafraîchi en tâche de fond
  // par useProgrammePolling (monté dans App), donc l'heure de départ et le
  // drapeau « départ imminent » restent synchronisés sans rechargement manuel.
  const programme = useProgrammeStore();
  const [race, setRace] = useState<ProviderRace | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const now = useAppClock();
  const autoLoadedRef = useRef(false);

  useEffect(() => {
    const reunion = Number(searchParams.get("reunion"));
    const course = Number(searchParams.get("course"));
    if (!reunion || !course || autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    const today = new Date().toISOString().slice(0, 10);
    setError(null);
    setLoading(true);
    api.programme(today)
      .then((prog) => {
        setProgrammeStore(prog);
        return api.course(today, reunion, course);
      })
      .then((r) => setRace(r))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const openInSimulator = (r: ProviderRace) => {
    setRaceStore(r, date);
    navigate("/simulator");
  };

  const loadProgramme = async () => {
    setError(null);
    setRace(null);
    setLoading(true);
    try {
      const prog = await api.programme(date);
      setProgrammeStore(prog);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadRace = async (reunion: number, course: number) => {
    setError(null);
    setLoading(true);
    setFavorites(new Set());
    try {
      setRace(await api.course(date, reunion, course));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Import PMU</h2>
      <div className="warn">
        Les données proviennent de l'API communautaire non-officielle turfinfo. Usage strictement
        personnel ; les réponses sont mises en cache côté serveur pour limiter les appels (le
        programme est rafraîchi fréquemment pour garder les heures de départ à jour).
      </div>

      <div className="panel">
        <div className="form-grid">
          <div className="field"><label>Date de la journée</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>&nbsp;</label><button onClick={loadProgramme} disabled={loading}>Charger le programme</button></div>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {programme && (() => {
        // Course à venir la plus proche (startTime > now, minimum).
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
                    const status = countdownStatus(c.startTime, now, c.departImminent);
                    const isNext = `${m.reunion}-${c.course}` === nextKey;
                    return (
                      <button
                        key={c.course}
                        className="secondary"
                        onClick={() => loadRace(m.reunion, c.course)}
                        style={isNext ? {
                          border: "2px solid var(--accent-2)",
                          background: "rgba(240,169,59,0.12)",
                          color: "var(--text)",
                          fontWeight: 700,
                        } : undefined}
                      >
                        {isNext && <span style={{ marginRight: 4 }}>▶</span>}
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

      {race && (
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h3 style={{ margin: 0 }}>R{race.reunion} C{race.course} — Partants &amp; cotes</h3>
              {(() => {
                const progRace = programme?.meetings
                  .find((m) => m.reunion === race.reunion)
                  ?.races.find((r) => r.course === race.course);
                // Privilégier le programme (rafraîchi périodiquement) sur la
                // course chargée une fois, pour garder l'heure/l'imminence à jour.
                const startTime = progRace?.startTime ?? race.startTime;
                const departImminent = progRace?.departImminent ?? race.departImminent;
                const status = countdownStatus(startTime, now, departImminent);
                if (!status) return null;
                return (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "6px 14px",
                      borderRadius: 14,
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "monospace",
                      background: status.color,
                      color: "#fff",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {status.time} · {status.label}
                  </span>
                );
              })()}
            </div>
            <button onClick={() => openInSimulator(race)}>
              Ouvrir dans le simulateur →
            </button>
          </div>
          <RunnersTable runners={race.runners} favorites={favorites} onToggleFavorite={(num) => setFavorites((prev) => { const next = new Set(prev); if (next.has(num)) next.delete(num); else next.add(num); return next; })} />
        </div>
      )}
    </div>
  );
}

type Runner = ProviderRace["runners"][number];

function RunnersTable({ runners, favorites, onToggleFavorite }: Readonly<{
  runners: Runner[];
  favorites: Set<number>;
  onToggleFavorite: (num: number) => void;
}>) {
  const eligible = runners.filter((r) => !r.scratched && r.odds != null);
  const minOdds = eligible.length > 0 ? Math.min(...eligible.map((r) => r.odds as number)) : null;
  const favNumber = minOdds == null ? null : eligible.find((r) => r.odds === minOdds)?.number;
  const { sorted: sortedRunners, sort, toggleSort } = useSortable(runners);

  return (
    <table style={{ marginTop: 16 }}>
      <thead>
        <tr>
          <th onClick={() => toggleSort('number')} style={{ cursor: 'pointer' }}>N° {sort.key === 'number' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
          <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>Cheval {sort.key === 'name' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
          <th onClick={() => toggleSort('jockey')} style={{ cursor: 'pointer' }}>Driver/Jockey {sort.key === 'jockey' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
          <th onClick={() => toggleSort('odds')} style={{ cursor: 'pointer' }}>Cote {sort.key === 'odds' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
        </tr>
      </thead>
      <tbody>
        {sortedRunners.map((r) => {
          const isFavPerso = favorites.has(r.number);
          const isFavori = r.number === favNumber;
          const rowClass = [
            r.scratched ? "runner-scratched" : "",
            isFavPerso ? "runner-fav-perso" : isFavori ? "runner-favori" : "",
          ].filter(Boolean).join(" ") || undefined;
          return (
            <tr
              key={r.number}
              className={rowClass}
              style={{ cursor: "pointer" }}
              onClick={() => { if (!r.scratched) onToggleFavorite(r.number); }}
            >
              <td>
                <span className="runner-num">
                  <span className="runner-num-val">{r.number}</span>
                  <span className="runner-badge">{isFavPerso ? "★" : isFavori ? "F" : ""}</span>
                </span>
              </td>
              <td>{r.name}{r.scratched ? " (NP)" : ""}</td>
              <td>{r.jockey ?? "—"}</td>
              <td>{r.odds == null ? "—" : r.odds.toFixed(1)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
