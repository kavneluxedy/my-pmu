import { useCallback, useEffect, useState } from "react";
import {
  api,
  type CitationBetType,
  type DutchingResult,
  type PayoutResult,
  type ProviderCitations,
  type TicketCost,
  type ValueBetResult,
} from "../api/client.js";
import {
  type BetType,
  BET_TYPE_LABELS,
  BET_TYPES,
  minStakeFor,
  trjFor,
} from "../lib/betTypes.js";
import { tryEvaluate } from "../lib/calc.js";
import {
  getStoredRace,
  refreshRace,
  useRacePolling,
  useRaceStore,
} from "../raceStore.js";
import { useSortable } from "../hooks/useSortable.js";

type Tab = "ticket" | "dutching" | "valuebet" | "payout";

/** Partants actifs (non non-partants) avec cote disponible. */
function activeRunners(race: ReturnType<typeof useRaceStore>) {
  if (!race) return [];
  return race.runners.filter((r) => !r.scratched && r.odds != null);
}

export default function Simulator() {
  const [tab, setTab] = useState<Tab>("ticket");
  const race = useRaceStore();
  const runners = activeRunners(race);

  // Rafraîchit automatiquement les cotes de la course chargée (~60 s).
  useRacePolling();

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
            {" — "}{runners.length} partants avec cote.
            {" "}Les cotes se rafraîchissent automatiquement.
          </span>
          <RefreshOddsButton />
        </div>
      )}

      <div className="tabs">
        <div className={`tab${tab === "ticket" ? " active" : ""}`} onClick={() => setTab("ticket")}>Tickets combinés</div>
        <div className={`tab${tab === "dutching" ? " active" : ""}`} onClick={() => setTab("dutching")}>Dutching</div>
        <div className={`tab${tab === "valuebet" ? " active" : ""}`} onClick={() => setTab("valuebet")}>Value bet</div>
        <div className={`tab${tab === "payout" ? " active" : ""}`} onClick={() => setTab("payout")}>Gains potentiels</div>
      </div>
      {tab === "ticket" && <TicketTab runners={runners} />}
      {tab === "dutching" && <DutchingTab runners={runners} />}
      {tab === "valuebet" && <ValueBetTab runners={runners} />}
      {tab === "payout" && <PayoutTab runners={runners} />}
    </div>
  );
}

function parseNums(s: string): number[] {
  return s.split(/[,\s]+/).map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n));
}

/**
 * Charge à la volée les « citations » (enjeux / rapports probables) de la course
 * actuellement stockée. On ne passe pas par le raceStore (données volumineuses,
 * propres au simulateur de gains) : on lit `date`/`reunion`/`course` depuis
 * `getStoredRace()` et on interroge l'API (cache serveur 30 s). No-op sans course.
 */
function useCitations(): {
  citations: ProviderCitations | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
} {
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

/** Bloc citations correspondant à un BetType, disponible et non vide. */
function citationBlockFor(
  citations: ProviderCitations | null,
  betType: BetType,
): CitationBetType | undefined {
  return citations?.betTypes.find(
    (b) => b.betType === betType && !b.indisponible && b.runners.length > 0,
  );
}

interface RunnerSummary {
  number: number;
  name: string;
  odds?: number;
}

/** Les 4 types de paris couverts par la prévision de gains. */
const PAYOUT_BET_TYPES: BetType[] = [
  "simple_gagnant",
  "simple_place",
  "couple_place",
  "couple_gagnant",
];

/** Un couplé porte sur une combinaison (2 chevaux), un simple sur un cheval. */
function isCouple(betType: BetType): boolean {
  return betType === "couple_gagnant" || betType === "couple_place";
}

/**
 * Prévision du gain potentiel pour Simple Gagnant/Placé et Couplé Gagnant/Placé,
 * en deux modes : à partir de la cote connue, ou à partir des enjeux misés
 * (rapport reconstruit selon la mécanique du pari mutuel).
 */
function PayoutTab({ runners }: { runners: RunnerSummary[] }) {
  const [betType, setBetType] = useState<BetType>("simple_gagnant");
  const [mode, setMode] = useState<"cote" | "masses">("cote");
  const [stake, setStake] = useState("2");
  // Mode cote.
  const [rapport, setRapport] = useState("4.5");
  const [selectedRunner, setSelectedRunner] = useState<number | null>(null);
  // Mode masses.
  const [totalPool, setTotalPool] = useState("10000");
  const [stakeOnSelection, setStakeOnSelection] = useState("1000");
  const [runnersCount, setRunnersCount] = useState(() =>
    runners.length > 0 ? String(runners.length) : "12",
  );
  const [result, setResult] = useState<PayoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Citations (enjeux réels) de la course chargée, pour pré-remplir les masses.
  const { citations, loading: citLoading, error: citError, reload: reloadCitations } =
    useCitations();

  const minStake = minStakeFor(betType);
  const couple = isCouple(betType);
  const citBlock = citationBlockFor(citations, betType);
  const citRunners = citBlock?.runners.filter((r) => !r.scratched) ?? [];

  // Le Simple Placé n'existe qu'à partir de 4 partants (2 ou 3 placés payés).
  const needsRunnersCount = betType === "simple_place";

  // Le rapport d'un partant n'est disponible que pour le Simple Gagnant : le
  // provider ne fournit qu'une cote gagnant, sans rapport placé. On ne propose
  // donc le sélecteur (pré-remplissage de la cote) qu'en cote hors placé.
  const canPickOdds = mode === "cote" && !couple && betType !== "simple_place";

  // Quand la course change, on propose son nombre de partants par défaut.
  useEffect(() => {
    if (runners.length > 0) setRunnersCount(String(runners.length));
    setSelectedRunner(null);
  }, [runners]);

  // Charge les enjeux réels dès qu'on bascule en mode « masses » (et à chaque
  // changement de course). En mode « cote » ils sont inutiles : on n'appelle pas.
  useEffect(() => {
    if (mode === "masses") void reloadCitations();
  }, [mode, runners, reloadCitations]);

  // Pré-remplit masse totale + enjeu du cheval depuis les citations réelles.
  const pickCitation = (enjeu: number) => {
    if (!citBlock) return;
    setTotalPool(String(citBlock.totalPool));
    setStakeOnSelection(String(enjeu));
  };

  // En passant sur un Simple Placé (mode cote), on vide le rapport s'il avait été
  // pré-rempli avec une cote gagnant : celle-ci ne s'applique pas à un placé.
  useEffect(() => {
    if (betType === "simple_place" && selectedRunner != null) {
      setSelectedRunner(null);
      setRapport("");
    }
  }, [betType, selectedRunner]);

  const pickRunner = (idx: number) => {
    const r = runners[idx];
    if (!r?.odds) return;
    setSelectedRunner(idx);
    // La cote du partant est une cote gagnant : on ne la reporte que pour le
    // Simple Gagnant. Pour un placé, le rapport doit être saisi manuellement.
    setRapport(r.odds.toFixed(2));
  };

  const run = async () => {
    setError(null);
    setResult(null);
    if (Number(stake) < minStake) {
      setError(`Mise minimale de ${minStake} € pour ${BET_TYPE_LABELS[betType]} sur pmu.fr.`);
      return;
    }
    try {
      const body =
        mode === "cote"
          ? { betType, unitStake: Number(stake), mode, rapportBrutPourUnEuro: Number(rapport) }
          : {
              betType,
              unitStake: Number(stake),
              mode,
              masses: {
                totalPool: Number(totalPool),
                ...(couple
                  ? { stakeOnCombination: Number(stakeOnSelection) }
                  : { stakeOnHorse: Number(stakeOnSelection) }),
                ...(needsRunnersCount ? { runnersCount: Number(runnersCount) } : {}),
              },
            };
      setResult(await api.simPayout(body));
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="panel">
      <p className="muted">
        Estime le gain d'un Simple ou d'un Couplé, soit à partir de la cote connue
        (gain = mise × cote), soit à partir des enjeux misés (le rapport est
        reconstruit selon la mécanique du pari mutuel).
      </p>

      {canPickOdds && runners.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Choisir un partant (remplit la cote automatiquement)
          </div>
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

      {mode === "masses" && getStoredRace() && (
        <div style={{ marginBottom: 14 }}>
          <div
            className="muted"
            style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, marginBottom: 6 }}
          >
            <span>
              {citRunners.length > 0
                ? "Choisir un partant (remplit masse totale et enjeu depuis les données réelles PMU)"
                : citLoading
                  ? "Chargement des enjeux réels…"
                  : citError
                    ? `Enjeux PMU indisponibles : ${citError}`
                    : "Aucun enjeu PMU pour ce type de pari (saisie manuelle possible ci-dessous)."}
            </span>
            <button
              className="secondary"
              onClick={() => void reloadCitations()}
              disabled={citLoading}
              style={{ whiteSpace: "nowrap" }}
            >
              {citLoading ? "…" : "↻ Actualiser les enjeux"}
            </button>
          </div>
          {citRunners.length > 0 && (
            <CitationPicker runners={citRunners} onPick={(r) => pickCitation(r.enjeu)} />
          )}
          {citRunners.length > 0 && couple && (
            <div className="warn" style={{ marginTop: 10 }}>
              Enjeu fourni <strong>par cheval</strong> par le PMU (pas par combinaison de 2
              chevaux) : l'estimation du rapport couplé est donc <strong>approximative</strong>.
            </div>
          )}
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label>Type de pari</label>
          <select value={betType} onChange={(e) => setBetType(e.target.value as BetType)}>
            {PAYOUT_BET_TYPES.map((t) => <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Mode de calcul</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "cote" | "masses")}>
            <option value="cote">À partir de la cote</option>
            <option value="masses">À partir des enjeux misés</option>
          </select>
        </div>
        <div className="field">
          <label>Mise (€)</label>
          <input type="number" step="0.5" min={minStake} value={stake} onChange={(e) => setStake(e.target.value)} />
        </div>

        {mode === "cote" ? (
          <div className="field" style={{ position: "relative" }}>
            <label>{betType === "simple_place" ? "Rapport placé pour 1 €" : "Cote / rapport pour 1 €"}</label>
            <input type="number" step="0.1" min="1" value={rapport} onChange={(e) => setRapport(e.target.value)} />
            {betType === "simple_place" && (
              <span className="muted" style={{ position: "absolute", top: "100%", left: 0, marginTop: 3, fontSize: 11 }}>
                À saisir : la cote gagnant ne s'applique pas au placé (rapport plus faible, lu sur pmu.fr / le ticket).
              </span>
            )}
          </div>
        ) : (
          <>
            <div className="field">
              <label>Masse totale misée (€)</label>
              <input type="number" step="100" value={totalPool} onChange={(e) => setTotalPool(e.target.value)} />
            </div>
            <div className="field">
              <label>{couple ? "Enjeu sur la combinaison (€)" : "Enjeu sur le cheval (€)"}</label>
              <input type="number" step="50" value={stakeOnSelection} onChange={(e) => setStakeOnSelection(e.target.value)} />
            </div>
            {needsRunnersCount && (
              <div className="field">
                <label>Nombre de partants</label>
                <input type="number" step="1" min="4" value={runnersCount} onChange={(e) => setRunnersCount(e.target.value)} />
              </div>
            )}
          </>
        )}

        <div className="field"><label>&nbsp;</label><button onClick={run}>Estimer le gain</button></div>
      </div>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className="result-box">
          <div>
            Rapport estimé : <strong>{result.rapportBrutPourUnEuro.toFixed(2)} €</strong> pour 1 € misé
            {result.mode === "masses" && " (rapport probable — non contractuel)"}.
          </div>
          <div style={{ marginTop: 8 }}>
            Gain brut : <strong style={{ color: "#35c46a" }}>{result.grossPayout.toFixed(2)} €</strong>
            {" — "}dont bénéfice net : <strong>{result.netProfit.toFixed(2)} €</strong>
            {" "}(mise {result.stake.toFixed(2)} € récupérée en cas de gain).
          </div>
        </div>
      )}

      {mode === "masses" && citRunners.length > 0 && (
        <CitationTable betType={betType} block={citBlock!} />
      )}
    </div>
  );
}

/**
 * Tableau des enjeux réels par cheval, avec le ratio (% des enjeux) et le
 * rapport probable indicatif (masse × TRJ ÷ enjeu). Trié par ratio décroissant,
 * favori mis en évidence. Indicatif, non contractuel.
 */
function CitationTable({ betType, block }: { betType: BetType; block: CitationBetType }) {
  const trj = trjFor(betType);
  const filtered = block.runners.filter((r) => !r.scratched);
  const { sorted: rows, sort, toggleSort } = useSortable(filtered);

  return (
    <div className="result-box" style={{ marginTop: 12 }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Rapports probables (enjeux réels PMU, indicatifs et non contractuels).
      </div>
      <table>
        <thead>
          <tr>
            <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>Partant {sort.key === 'name' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
            <th onClick={() => toggleSort('enjeu')} style={{ cursor: 'pointer' }}>Enjeu {sort.key === 'enjeu' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
            <th onClick={() => toggleSort('ratio')} style={{ cursor: 'pointer' }}>Part {sort.key === 'ratio' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
            <th>Rapport probable</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rapport = r.enjeu > 0 ? (block.totalPool * trj) / r.enjeu : 0;
            return (
              <tr key={r.number} style={r.favoris ? { fontWeight: 600 } : {}}>
                <td>{r.number} — {r.name}{r.favoris ? " ★" : ""}</td>
                <td>{r.enjeu.toLocaleString("fr-FR")}</td>
                <td>{r.ratio != null ? `${r.ratio.toFixed(1)} %` : "—"}</td>
                <td>{rapport >= 1 ? `${rapport.toFixed(2)} €` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Grille de boutons partants pour les citations (n° — nom, enjeu et ratio %).
 * Sœur de `RunnerPicker` mais affichant l'enjeu misé au lieu de la cote.
 */
function CitationPicker({
  runners,
  onPick,
}: {
  runners: CitationBetType["runners"];
  onPick: (r: CitationBetType["runners"][number]) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {runners.map((r) => (
        <button key={r.number} className="secondary" onClick={() => onPick(r)}>
          {r.number} — {r.name}
          {r.ratio != null ? ` (${r.ratio.toFixed(1)} %)` : ""}
        </button>
      ))}
    </div>
  );
}

/** Bouton d'actualisation manuelle des cotes de la course chargée. */
function RefreshOddsButton() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await refreshRace();
    } catch {
      // Silencieux : le polling réessaiera de toute façon.
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className="secondary" onClick={run} disabled={busy} style={{ whiteSpace: "nowrap" }}>
      {busy ? "Actualisation…" : "↻ Actualiser les cotes"}
    </button>
  );
}

/**
 * Grille de boutons partants réutilisable (n° — nom (cote)). Un partant est mis
 * en surbrillance quand `isSelected(r)` est vrai ; le clic déclenche `onPick`.
 */
function RunnerPicker({
  runners,
  isSelected,
  onPick,
}: {
  runners: RunnerSummary[];
  isSelected: (r: RunnerSummary) => boolean;
  onPick: (r: RunnerSummary) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {runners.map((r) => {
        const selected = isSelected(r);
        return (
          <button
            key={r.number}
            className={selected ? undefined : "secondary"}
            style={selected ? { background: "#35c46a", color: "#0b1a10" } : {}}
            onClick={() => onPick(r)}
          >
            {r.number} — {r.name} ({r.odds!.toFixed(1)})
          </button>
        );
      })}
    </div>
  );
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
            {BET_TYPES.map((t) => <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>)}
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
  const hasRace = runners.length > 0;
  // Sélection par numéro de partant : robuste au polling (les numéros restent
  // stables même quand les cotes changent), contrairement à un index de tableau.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Champ texte de secours quand aucune course n'est chargée (saisie libre).
  const [rows, setRows] = useState("2, 4, 6");
  const [mode, setMode] = useState<"budget" | "target">("budget");
  const [amount, setAmount] = useState("100");
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
        if (selectedRunners.length < 2) {
          setError("Sélectionnez au moins deux partants pour le dutching.");
          return;
        }
        // Cotes fraîches relues au moment du calcul + libellé n° + nom conservé.
        selections = selectedRunners.map((r) => ({
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
      {result && (() => {
        const { sorted: sortedLegs, sort, toggleSort } = useSortable(result.legs);
        return (
        <div className="result-box">
          <table>
            <thead><tr><th onClick={() => toggleSort('selection')} style={{ cursor: 'pointer' }}>Partant {sort.key === 'selection' && (sort.direction === 'asc' ? '▲' : '▼')}</th><th onClick={() => toggleSort('odds')} style={{ cursor: 'pointer' }}>Cote {sort.key === 'odds' && (sort.direction === 'asc' ? '▲' : '▼')}</th><th onClick={() => toggleSort('stake')} style={{ cursor: 'pointer' }}>Mise {sort.key === 'stake' && (sort.direction === 'asc' ? '▲' : '▼')}</th><th onClick={() => toggleSort('grossReturn')} style={{ cursor: 'pointer' }}>Retour si gagnant {sort.key === 'grossReturn' && (sort.direction === 'asc' ? '▲' : '▼')}</th></tr></thead>
            <tbody>
              {sortedLegs.map((l) => (
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
        );
      })()}
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
    selectedNumber != null
      ? citBlock?.runners.find((r) => r.number === selectedNumber)?.ratio
      : undefined;

  // Quand on sélectionne un partant PMU, on remplit la cote automatiquement.
  const pickRunner = (r: RunnerSummary) => {
    setSelectedNumber(r.number);
    setOdds(r.odds!.toFixed(2));
  };

  // Garde la cote du partant sélectionné synchronisée avec les cotes fraîches ;
  // désélectionne s'il disparaît (non-partant / course changée).
  useEffect(() => {
    if (selectedNumber == null) return;
    const r = runners.find((x) => x.number === selectedNumber);
    if (!r) {
      setSelectedNumber(null);
    } else {
      setOdds(r.odds!.toFixed(2));
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
                ↳ marché {marketRatio.toFixed(1)} %
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
