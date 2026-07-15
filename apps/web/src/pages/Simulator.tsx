import { useEffect, useState } from "react";
import { api, DutchingResult, ValueBetResult } from "../api/client.js";
import AddToBetsButton from "../components/AddToBetsButton.js";
import RefreshOddsButton from "../components/RefreshOddsButton.js";
import RunnerPicker from "../components/RunnerPicker.js";
import SaveRaceButton from "../components/SaveRaceButton.js";
import { useCitations } from "../hooks/useCitations.js";
import { useQuickAddBet } from "../hooks/useQuickAddBet.js";
import { useSortable } from "../hooks/useSortable.js";
import { BET_TYPE_LABELS, BET_TYPES, BetType, minStakeFor } from "../lib/betTypes.js";
import { parseNums, tryEvaluate } from "../lib/calc.js";
import { citationBlockFor } from "../lib/citation.js";
import { RunnerSummary } from "../lib/runner.js";
import { roundStakeToEuro } from "../lib/stake.js";
import { getStoredRace, useRacePolling, useRaceRefreshBeforeStart, useRaceStore } from "../raceStore.js";
import PayoutTab from "./PayoutTab.js";

type Tab = "dutching" | "valuebet" | "payout";

/**
 * Partants actifs (non non-partants). On NE filtre PAS sur la présence de cote :
 * l'API PMU cesse de fournir `odds` une fois les paris clôturés / la course
 * passée, mais les partants doivent rester visibles dans les 3 onglets (avec
 * saisie manuelle possible pour Dutching/ValueBet, et calcul par masses pour
 * Payout). Le badge de cote s'affiche quand `odds` est connu, sinon rien.
 */
function activeRunners(race: ReturnType<typeof useRaceStore>) {
  if (!race) return [];
  return race.runners.filter((r) => !r.scratched);
}

export default function Simulator() {
  const [tab, setTab] = useState<Tab>("dutching");
  const race = useRaceStore();
  const runners = activeRunners(race);

  useRacePolling();
  useRaceRefreshBeforeStart();

  return (
    <div>
      <h2>Simulateur</h2>

      {race && (
        <div
          className="panel"
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span className="muted" style={{ fontSize: 13 }}>
            Course chargée : <strong>R{race.reunion} C{race.course}</strong>
            {race.name && <>{" — "}<strong>{race.name}</strong></>}
            {" — "}{runners.length} partants.
            {" "}Les cotes se rafraîchissent automatiquement.
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <RefreshOddsButton />
            <SaveRaceButton />
          </div>
        </div>
      )}

      <div className="tabs">
        <button type="button" className={`tab${tab === "dutching" ? " active" : ""}`} onClick={() => setTab("dutching")}>Dutching</button>
        <button type="button" className={`tab${tab === "valuebet" ? " active" : ""}`} onClick={() => setTab("valuebet")}>Value bet</button>
        <button type="button" className={`tab${tab === "payout" ? " active" : ""}`} onClick={() => setTab("payout")}>Gains potentiels</button>
      </div>
      {tab === "dutching" && <DutchingTab runners={runners} />}
      {tab === "valuebet" && <ValueBetTab runners={runners} />}
      {tab === "payout" && <PayoutTab runners={runners} />}
    </div>
  );
}

function DutchingTab({ runners }: { runners: RunnerSummary[] }) {
  const hasRace = runners.length > 0;
  // Sélection par numéro de partant : robuste au polling (les numéros restent
  // stables même quand les cotes changent), contrairement à un index de tableau.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Champ texte de secours quand aucune course n'est chargée (saisie libre).
  const [rows, setRows] = useState("2, 4, 6");
  const [mode, setMode] = useState<"budget" | "target">("budget");
  const [amount, setAmount] = useState("10");
  const [result, setResult] = useState<DutchingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Purge de la sélection : retire les partants qui ont disparu ou sont devenus
  // non-partants. On NE réinitialise PAS la sélection à chaque rafraîchissement
  // des cotes, pour que le choix de l'utilisateur reste visible et stable.
  useEffect(() => {
    const valid = new Set(runners.map((r) => r.number));
    setSelected((prev) => {
      const next = new Set([...prev].filter((n) => valid.has(n)));
      return next.size === prev.size ? prev : next;
    });
  }, [runners]);

  const toggle = (r: RunnerSummary) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r.number)) next.delete(r.number);
      else next.add(r.number);
      return next;
    });
  };

  // Partants retenus, dans l'ordre du programme, avec leur cote (fraîche) à jour.
  const selectedRunners = runners.filter((r) => selected.has(r.number));

  const run = async () => {
    setError(null);
    try {
      let selections: { selection: number | string; odds: number }[];
      if (hasRace) {
        // Le dutching se calcule à partir des cotes : on ne retient que les
        // partants sélectionnés dont la cote est connue (l'API PMU peut ne plus
        // la fournir une fois les paris clôturés).
        const withOdds = selectedRunners.filter((r) => r.odds != null);
        if (withOdds.length < 2) {
          setError(
            selectedRunners.length >= 2
              ? "Cotes indisponibles pour les partants sélectionnés : le dutching nécessite au moins deux cotes connues."
              : "Sélectionnez au moins deux partants (avec cote) pour le dutching.",
          );
          return;
        }
        // Cotes fraîches relues au moment du calcul + libellé n° + nom conservé.
        selections = withOdds.map((r) => ({
          selection: `${r.number} ${r.name}`,
          odds: r.odds!,
        }));
      } else {
        const odds = parseNums(rows);
        selections = odds.map((o, i) => ({ selection: i + 1, odds: o }));
      }
      const res = await api.simDutching({ selections, mode, amount: Number(amount) });
      setResult(res);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="panel">
      <p className="muted">Répartit la mise pour un retour identique quel que soit le gagnant parmi les sélectionnés.</p>

      {hasRace && (
        <div style={{ marginBottom: 14 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Sélectionnez les partants à inclure ({selectedRunners.length} sélectionné{selectedRunners.length > 1 ? "s" : ""}) — les cotes sont à jour.
          </div>
          <RunnerPicker runners={runners} isSelected={(r) => selected.has(r.number)} onPick={toggle} />
        </div>
      )}

      <div className="form-grid">
        {!hasRace && (
          <div className="field" style={{ gridColumn: "span 2" }}><label>Cotes des partants (décimales)</label><input value={rows} onChange={(e) => setRows(e.target.value)} placeholder="2, 4, 6" /></div>
        )}
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
      {result && <DutchingResultTable result={result} />}
    </div>
  );
}

function DutchingResultTable({ result }: { result: DutchingResult }) {
  const { sorted: sortedLegs, sort, toggleSort } = useSortable(result.legs);
  const { addBets } = useQuickAddBet();
  const [roundStakes, setRoundStakes] = useState(true);

  const stored = getStoredRace();
  const ctx = stored ? `R${stored.race.reunion}C${stored.race.course} - ` : "Dutching manuel - ";
  const minStake = minStakeFor("simple_gagnant");

  const addAll = async () => {
    const drafts = result.legs.map((l) => ({
      date: new Date().toISOString().slice(0, 10),
      betType: "simple_gagnant",
      label: `${ctx}n°${l.selection}`,
      stake: roundStakes ? roundStakeToEuro(l.stake, minStake) : l.stake,
      odds: l.odds,
    }));
    await addBets(drafts);
  };

  return (
    <div className="result-box">
      <table>
        <thead>
          <tr>
            <th onClick={() => toggleSort('selection')} style={{ cursor: 'pointer' }}>Partant {sort.key === 'selection' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
            <th onClick={() => toggleSort('odds')} style={{ cursor: 'pointer' }}>Cote {sort.key === 'odds' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
            <th onClick={() => toggleSort('stake')} style={{ cursor: 'pointer' }}>Mise {sort.key === 'stake' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
            <th onClick={() => toggleSort('grossReturn')} style={{ cursor: 'pointer' }}>Retour si gagnant {sort.key === 'grossReturn' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedLegs.map((l) => (
            <tr key={String(l.selection)}>
              <td>{l.selection}</td>
              <td>{l.odds}</td>
              <td>{l.stake.toFixed(2)} €</td>
              <td>{l.grossReturn.toFixed(2)} €</td>
              <td>
                <AddToBetsButton
                  label="🎫 Parier"
                  defaultStake={l.stake}
                  minStake={minStake}
                  getDraft={(date, stake) => ({
                    date,
                    betType: "simple_gagnant",
                    label: `${ctx}n°${l.selection}`,
                    stake,
                    odds: l.odds,
                  })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12 }}>
        Mise totale : <strong>{result.totalStake.toFixed(2)} €</strong> — Retour garanti :
        <strong> {result.guaranteedReturn.toFixed(2)} €</strong> — Profit garanti :
        <strong style={{ color: result.guaranteedProfit >= 0 ? "#35c46a" : "#e8556b" }}> {result.guaranteedProfit.toFixed(2)} €</strong>
      </div>
      {result.isArbitrage
        ? <div className="warn" style={{ marginTop: 10 }}>Situation d'arbitrage : profit garanti positif (somme des probabilités {result.impliedProbabilitySum} &lt; 1).</div>
        : <div className="warn" style={{ marginTop: 10 }}>Pas d'arbitrage : la marge est défavorable (somme des probabilités {result.impliedProbabilitySum} ≥ 1).</div>}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button className="cta-add-bet" onClick={addAll}>
          🎫 Tout ajouter ({result.legs.length} pari{result.legs.length > 1 ? "s" : ""})
        </button>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={roundStakes} onChange={(e) => setRoundStakes(e.target.checked)} />
          Arrondir les mises à l'euro
        </label>
      </div>
    </div>
  );
}

function ValueBetTab({ runners }: { runners: RunnerSummary[] }) {
  // Suivi par numéro de partant (stable au polling), pas par index de tableau.
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [betType, setBetType] = useState<BetType>("simple_gagnant");
  const [odds, setOdds] = useState("3");
  // Le champ proba accepte une expression : décimal (0.4), fraction (3/8),
  // pourcentage (40%) ou petit calcul (1/(1+2)). On évalue en direct.
  const [prob, setProb] = useState("0.4");
  const [stake, setStake] = useState("2");
  const [bankroll, setBankroll] = useState("100");
  const [result, setResult] = useState<ValueBetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Valeur de proba interprétée à partir de l'expression saisie.
  const probValue = tryEvaluate(prob);
  const probOutOfRange = probValue != null && (probValue < 0 || probValue > 1);

  // Mise minimale imposée par le type de pari (règle pmu.fr).
  const minStake = minStakeFor(betType);

  // Citations (répartition des enjeux) : le ratio du marché sert de probabilité
  // implicite « sagesse de la foule », pré-remplissable comme proba estimée.
  const { citations, reload: reloadCitations } = useCitations();
  const citBlock = citationBlockFor(citations, betType);

  // Charge les citations quand une course est présente (proba marché disponible).
  useEffect(() => {
    if (getStoredRace()) void reloadCitations();
  }, [runners, reloadCitations]);

  // Ratio (%) du partant sélectionné pour le type de pari courant, si dispo.
  const marketRatio =
    selectedNumber == null
      ? undefined
      : citBlock?.runners.find((r) => r.number === selectedNumber)?.ratio;

  // Quand on sélectionne un partant PMU, on remplit la cote automatiquement
  // (si connue ; sinon on laisse le champ tel quel pour saisie manuelle).
  const pickRunner = (r: RunnerSummary) => {
    setSelectedNumber(r.number);
    if (r.odds != null) setOdds(r.odds.toFixed(2));
  };

  // Garde la cote du partant sélectionné synchronisée avec les cotes fraîches ;
  // désélectionne s'il disparaît (non-partant / course changée).
  useEffect(() => {
    if (selectedNumber == null) return;
    const r = runners.find((x) => x.number === selectedNumber);
    if (!r) {
      setSelectedNumber(null);
    } else if (r.odds != null) {
      setOdds(r.odds.toFixed(2));
    }
  }, [runners, selectedNumber]);

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
    if (Number(stake) < minStake) {
      setError(`Mise minimale de ${minStake} € pour ${BET_TYPE_LABELS[betType]} sur pmu.fr.`);
      return;
    }
    try {
      const res = await api.simValueBet({
        betType,
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
          <RunnerPicker runners={runners} isSelected={(r) => r.number === selectedNumber} onPick={pickRunner} />
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label>Type de pari</label>
          <select value={betType} onChange={(e) => setBetType(e.target.value as BetType)}>
            {BET_TYPES.map((t) => <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div className="field"><label>Cote décimale</label><input type="number" step="0.1" value={odds} onChange={(e) => setOdds(e.target.value)} /></div>
        <div className="field" style={{ position: "relative" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Proba estimée (fraction, % ou décimal)</span>
            {marketRatio != null && (
              <button
                type="button"
                className="secondary"
                onClick={() => setProb(String(marketRatio / 100))}
                title="Utiliser la part des enjeux du marché comme probabilité de départ"
                style={{ fontSize: 11, padding: "1px 6px" }}
              >
                ↳ marché {marketRatio.toFixed(2)} %
              </button>
            )}
          </label>
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
        <div className="field" style={{ position: "relative" }}>
          <label>Mise de référence (€)</label>
          <input
            type="number"
            step="0.5"
            min={minStake}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            style={Number(stake) < minStake ? { outline: "1px solid var(--danger)" } : {}}
          />
          <span className="muted" style={{ position: "absolute", top: "100%", left: 0, marginTop: 3, fontSize: 11, whiteSpace: "nowrap" }}>
            {Number(stake) < minStake ? `Min ${minStake} € (pmu.fr)` : `Minimum : ${minStake} €`}
          </span>
        </div>
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
          <div style={{ marginTop: 12 }}>
            <AddToBetsButton
              label="🎫 Ajouter à Mes paris"
              defaultStake={result.kellyStake}
              minStake={minStakeFor(betType)}
              disabled={result.kellyStake <= 0}
              disabledReason="Mise de Kelly nulle : pas de valeur détectée"
              getDraft={(date, stake) => {
                const stored = getStoredRace();
                const runner = selectedNumber != null ? runners.find((r) => r.number === selectedNumber) : undefined;
                const ctx = stored ? `R${stored.race.reunion}C${stored.race.course} - ` : "";
                return {
                  date,
                  betType,
                  label: `${ctx}${runner ? `n°${runner.number} ${runner.name}` : `Value bet cote ${odds}`}`,
                  stake,
                  odds: Number(odds),
                };
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mini-calculette repliable. Évalue une expression (fractions, %, parenthèses)
 * et permet de réinjecter le résultat comme proba estimée.
 */
function MiniCalc({ onUseAsProb }: Readonly<{ onUseAsProb: (v: number) => void }>) {
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