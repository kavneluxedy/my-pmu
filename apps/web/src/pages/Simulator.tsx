import { useEffect, useState } from "react";
import {
  api,
  type DutchingResult,
  type TicketCost,
  type ValueBetResult,
} from "../api/client.js";
import { tryEvaluate } from "../lib/calc.js";
import { useRaceStore } from "../raceStore.js";

type Tab = "ticket" | "dutching" | "valuebet";

/** Partants actifs (non non-partants) avec cote disponible. */
function activeRunners(race: ReturnType<typeof useRaceStore>) {
  if (!race) return [];
  return race.runners.filter((r) => !r.scratched && r.odds != null);
}

export default function Simulator() {
  const [tab, setTab] = useState<Tab>("ticket");
  const race = useRaceStore();
  const runners = activeRunners(race);

  return (
    <div>
      <h2>Simulateur</h2>

      {race && (
        <div className="panel" style={{ marginBottom: 16, padding: "12px 16px" }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Course chargée : <strong>R{race.reunion} C{race.course}</strong>
            {" — "}{runners.length} partants avec cote.
            {" "}Les onglets ci-dessous sont pré-remplis.
          </span>
        </div>
      )}

      <div className="tabs">
        <div className={`tab${tab === "ticket" ? " active" : ""}`} onClick={() => setTab("ticket")}>Tickets combinés</div>
        <div className={`tab${tab === "dutching" ? " active" : ""}`} onClick={() => setTab("dutching")}>Dutching</div>
        <div className={`tab${tab === "valuebet" ? " active" : ""}`} onClick={() => setTab("valuebet")}>Value bet</div>
      </div>
      {tab === "ticket" && <TicketTab runners={runners} />}
      {tab === "dutching" && <DutchingTab runners={runners} />}
      {tab === "valuebet" && <ValueBetTab runners={runners} />}
    </div>
  );
}

function parseNums(s: string): number[] {
  return s.split(/[,\s]+/).map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n));
}

interface RunnerSummary {
  number: number;
  name: string;
  odds?: number;
}

function TicketTab({ runners }: { runners: RunnerSummary[] }) {
  const [betType, setBetType] = useState("tierce");
  const [bases, setBases] = useState("");
  const [associated, setAssociated] = useState(() =>
    runners.length > 0 ? runners.map((r) => r.number).join(", ") : "1,2,3,4",
  );
  const [ordered, setOrdered] = useState(false);
  const [unitStake, setUnitStake] = useState("1.5");
  const [result, setResult] = useState<TicketCost | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mise à jour du champ si la course change après le montage.
  useEffect(() => {
    if (runners.length > 0) {
      setAssociated(runners.map((r) => r.number).join(", "));
    }
  }, [runners]);

  const run = async () => {
    setError(null);
    try {
      const res = await api.simTicket({
        betType,
        selection: { bases: parseNums(bases), associated: parseNums(associated), ordered },
        unitStake: Number(unitStake),
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="panel">
      <p className="muted">Calcule le nombre de combinaisons et le coût d'un ticket combiné en champ réduit.</p>
      <div className="form-grid">
        <div className="field">
          <label>Type de pari</label>
          <select value={betType} onChange={(e) => setBetType(e.target.value)}>
            {["simple_gagnant", "simple_place", "couple_gagnant", "couple_place", "trio", "tierce", "quarte", "quinte", "multi"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field"><label>Chevaux de base</label><input value={bases} onChange={(e) => setBases(e.target.value)} placeholder="ex: 7" /></div>
        <div className="field"><label>Champ associé</label><input value={associated} onChange={(e) => setAssociated(e.target.value)} placeholder="1,2,3,4" /></div>
        <div className="field"><label>Mise unitaire (€)</label><input type="number" step="0.5" value={unitStake} onChange={(e) => setUnitStake(e.target.value)} /></div>
        <div className="field">
          <label>Ordre</label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={ordered} onChange={(e) => setOrdered(e.target.checked)} style={{ width: "auto" }} /> jouer l'ordre
          </label>
        </div>
        <div className="field"><label>&nbsp;</label><button onClick={run}>Calculer</button></div>
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="result-box">
          <div><strong>{result.combinations}</strong> combinaisons × {result.unitStake.toFixed(2)} € =
            <strong> {result.totalCost.toFixed(2)} €</strong> de coût total.</div>
        </div>
      )}
    </div>
  );
}

function DutchingTab({ runners }: { runners: RunnerSummary[] }) {
  const [rows, setRows] = useState(() =>
    runners.length > 0
      ? runners.map((r) => r.odds!.toFixed(1)).join(", ")
      : "2, 4, 6",
  );
  const [mode, setMode] = useState<"budget" | "target">("budget");
  const [amount, setAmount] = useState("100");
  const [result, setResult] = useState<DutchingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (runners.length > 0) {
      setRows(runners.map((r) => r.odds!.toFixed(1)).join(", "));
    }
  }, [runners]);

  const run = async () => {
    setError(null);
    try {
      const odds = parseNums(rows);
      // Si une course PMU est chargée on utilise nom+numéro, sinon indices.
      const labels =
        runners.length === odds.length
          ? runners.map((r) => `${r.number} ${r.name}`)
          : odds.map((_, i) => i + 1);
      const res = await api.simDutching({
        selections: odds.map((o, i) => ({ selection: labels[i] ?? i + 1, odds: o })),
        mode,
        amount: Number(amount),
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="panel">
      <p className="muted">Répartit la mise pour un retour identique quel que soit le gagnant parmi les sélectionnés.</p>
      <div className="form-grid">
        <div className="field" style={{ gridColumn: "span 2" }}><label>Cotes des partants (décimales)</label><input value={rows} onChange={(e) => setRows(e.target.value)} placeholder="2, 4, 6" /></div>
        <div className="field">
          <label>Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "budget" | "target")}>
            <option value="budget">Budget fixe à répartir</option>
            <option value="target">Profit net visé</option>
          </select>
        </div>
        <div className="field"><label>{mode === "budget" ? "Budget (€)" : "Profit visé (€)"}</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="field"><label>&nbsp;</label><button onClick={run}>Calculer</button></div>
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="result-box">
          <table>
            <thead><tr><th>Partant</th><th>Cote</th><th>Mise</th><th>Retour si gagnant</th></tr></thead>
            <tbody>
              {result.legs.map((l) => (
                <tr key={String(l.selection)}><td>{l.selection}</td><td>{l.odds}</td><td>{l.stake.toFixed(2)} €</td><td>{l.grossReturn.toFixed(2)} €</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12 }}>
            Mise totale : <strong>{result.totalStake.toFixed(2)} €</strong> — Retour garanti :
            <strong> {result.guaranteedReturn.toFixed(2)} €</strong> — Profit garanti :
            <strong className={result.guaranteedProfit >= 0 ? "" : ""} style={{ color: result.guaranteedProfit >= 0 ? "#35c46a" : "#e8556b" }}> {result.guaranteedProfit.toFixed(2)} €</strong>
          </div>
          {result.isArbitrage
            ? <div className="warn" style={{ marginTop: 10 }}>Situation d'arbitrage : profit garanti positif (somme des probabilités {result.impliedProbabilitySum} &lt; 1).</div>
            : <div className="warn" style={{ marginTop: 10 }}>Pas d'arbitrage : la marge est défavorable (somme des probabilités {result.impliedProbabilitySum} ≥ 1).</div>}
        </div>
      )}
    </div>
  );
}

function ValueBetTab({ runners }: { runners: RunnerSummary[] }) {
  const [selectedRunner, setSelectedRunner] = useState<number | null>(null);
  const [odds, setOdds] = useState("3");
  // Le champ proba accepte une expression : décimal (0.4), fraction (3/8),
  // pourcentage (40%) ou petit calcul (1/(1+2)). On évalue en direct.
  const [prob, setProb] = useState("0.4");
  const [stake, setStake] = useState("10");
  const [bankroll, setBankroll] = useState("1000");
  const [result, setResult] = useState<ValueBetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Valeur de proba interprétée à partir de l'expression saisie.
  const probValue = tryEvaluate(prob);
  const probOutOfRange = probValue != null && (probValue < 0 || probValue > 1);

  // Quand on sélectionne un partant PMU, on remplit la cote automatiquement.
  const pickRunner = (idx: number) => {
    const r = runners[idx];
    if (!r) return;
    setSelectedRunner(idx);
    setOdds(r.odds!.toFixed(2));
  };

  // Reset la sélection si la course change.
  useEffect(() => {
    setSelectedRunner(null);
  }, [runners]);

  const run = async () => {
    setError(null);
    if (probValue == null) {
      setError("Proba estimée invalide : entrez un nombre, une fraction (3/8) ou un pourcentage (40%).");
      return;
    }
    if (probOutOfRange) {
      setError("Proba estimée hors bornes : elle doit être comprise entre 0 et 1 (soit 0 % et 100 %).");
      return;
    }
    try {
      const res = await api.simValueBet({
        odds: Number(odds),
        estimatedProbability: probValue,
        stake: Number(stake),
        bankroll: Number(bankroll),
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="panel">
      <p className="muted">Compare votre probabilité estimée à la cote pour détecter une valeur positive (EV+) et propose une mise de Kelly (quart de Kelly).</p>

      {runners.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Choisir un partant (remplit la cote automatiquement)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {runners.map((r, i) => (
              <button
                key={r.number}
                className={selectedRunner === i ? undefined : "secondary"}
                style={selectedRunner === i ? { background: "#35c46a", color: "#0b1a10" } : {}}
                onClick={() => pickRunner(i)}
              >
                {r.number} — {r.name} ({r.odds!.toFixed(1)})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-grid">
        <div className="field"><label>Cote décimale</label><input type="number" step="0.1" value={odds} onChange={(e) => setOdds(e.target.value)} /></div>
        <div className="field" style={{ position: "relative" }}>
          <label>Proba estimée (fraction, % ou décimal)</label>
          <input
            type="text"
            value={prob}
            onChange={(e) => setProb(e.target.value)}
            placeholder="ex: 3/8, 40% ou 0.4"
            style={probValue == null || probOutOfRange ? { outline: "1px solid var(--danger)" } : {}}
          />
          {/* Aperçu positionné en absolu pour ne pas décaler l'alignement de la grille. */}
          <span
            className="muted"
            style={{ position: "absolute", top: "100%", left: 0, marginTop: 3, fontSize: 11, whiteSpace: "nowrap" }}
          >
            {prob.trim() === ""
              ? " "
              : probValue == null
                ? "Expression invalide"
                : probOutOfRange
                  ? `= ${(probValue * 100).toFixed(2)} % (hors 0–100 %)`
                  : `= ${probValue.toFixed(4)} soit ${(probValue * 100).toFixed(2)} %`}
          </span>
        </div>
        <div className="field"><label>Mise de référence (€)</label><input type="number" value={stake} onChange={(e) => setStake(e.target.value)} /></div>
        <div className="field"><label>Bankroll (€)</label><input type="number" value={bankroll} onChange={(e) => setBankroll(e.target.value)} /></div>
        <div className="field"><label>&nbsp;</label><button onClick={run}>Analyser</button></div>
      </div>

      <MiniCalc onUseAsProb={(v) => setProb(String(v))} />

      {error && <p className="error">{error}</p>}
      {result && (
        <div className="result-box">
          <div>Proba implicite de la cote : <strong>{(result.impliedProbability * 100).toFixed(1)} %</strong> vs votre estimation <strong>{(result.estimatedProbability * 100).toFixed(1)} %</strong></div>
          <div style={{ marginTop: 8 }}>Espérance de gain : <strong style={{ color: result.expectedValue >= 0 ? "#35c46a" : "#e8556b" }}>{result.expectedValue.toFixed(2)} €</strong> — Edge : <strong>{(result.edge * 100).toFixed(1)} %</strong></div>
          <div style={{ marginTop: 8 }}>Mise conseillée (¼ Kelly) : <strong>{result.kellyStake.toFixed(2)} €</strong></div>
          {result.isValueBet
            ? <div className="warn" style={{ marginTop: 10, color: "#35c46a", borderColor: "#35c46a", background: "rgba(53,196,106,0.1)" }}>✔ Pari à valeur positive (EV+).</div>
            : <div className="warn" style={{ marginTop: 10 }}>Pas de valeur : votre estimation ne bat pas la cote.</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Mini-calculette repliable. Évalue une expression (fractions, %, parenthèses)
 * et permet de réinjecter le résultat comme proba estimée.
 */
function MiniCalc({ onUseAsProb }: { onUseAsProb: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("3/8");
  const value = tryEvaluate(expr);

  return (
    <div style={{ marginTop: 14 }}>
      <button
        className="secondary"
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: 13 }}
      >
        🧮 Calculette {open ? "▲" : "▼"}
      </button>

      {open && (
        <div className="result-box" style={{ marginTop: 10 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Tapez un calcul : fractions <code>3/8</code>, pourcentages <code>40%</code>,
            parenthèses <code>1/(1+2)</code>… (opérateurs + − × ÷).
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="ex: 1/(1+2.5)"
              style={{ flex: "1 1 200px", ...(expr.trim() && value == null ? { outline: "1px solid var(--danger)" } : {}) }}
            />
            <div style={{ minWidth: 130, fontVariantNumeric: "tabular-nums" }}>
              {expr.trim() === ""
                ? <span className="muted">= —</span>
                : value == null
                  ? <span style={{ color: "var(--danger)" }}>= erreur</span>
                  : <strong>= {value.toFixed(6).replace(/\.?0+$/, "")}</strong>}
            </div>
            <button
              disabled={value == null}
              onClick={() => value != null && onUseAsProb(value)}
              style={value == null ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              title="Utiliser ce résultat comme probabilité estimée"
            >
              → Proba estimée
            </button>
          </div>
          {value != null && (
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Soit <strong>{(value * 100).toFixed(2)} %</strong>
              {(value < 0 || value > 1) && " (hors 0–100 %, non valide comme probabilité)"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
