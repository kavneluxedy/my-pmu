import { useEffect, useState } from "react";
import {
   api,
   type PayoutResult,
   type PlaceReport,
} from "../api/client.js";
import CitationPicker from "../components/CitationPicker.js";
import CitationTable from "../components/CitationTable.js";
import { useCitations } from "../hooks/useCitations.js";
import { usePlaceReports } from "../hooks/usePlaceReports.js";
import { BET_TYPE_LABELS, BET_TYPES, minStakeFor, type BetType } from "../lib/betTypes.js";
import { citationBlockFor } from "../lib/citation.js";
import type { RunnerSummary } from "../lib/runner.js";
import { getStoredRace } from "../raceStore.js";

function medianRapport(pr: PlaceReport): number {
   return (pr.minRapport + pr.maxRapport) / 2;
}

export default function PayoutTab({ runners }: Readonly<{ runners: RunnerSummary[] }>) {
   const [betType, setBetType] = useState<BetType>(BET_TYPES[0]);
   const [mode, setMode] = useState<"cote" | "masses">("cote");
   const [stake, setStake] = useState("2");
   const [rapport, setRapport] = useState("4.5");
   const [selectedRunner, setSelectedRunner] = useState<number | null>(null);
   const [totalPool, setTotalPool] = useState("10000");
   const [stakeOnSelection, setStakeOnSelection] = useState("1000");
   const [runnersCount, setRunnersCount] = useState(() =>
      runners.length > 0 ? String(runners.length) : "12",
   );
   const [result, setResult] = useState<PayoutResult | null>(null);
   const [error, setError] = useState<string | null>(null);

   const { citations, loading: citLoading, error: citError, reload: reloadCitations } =
      useCitations();
   const { reports: placeReports, loading: prLoading, reload: reloadPlaceReports } =
      usePlaceReports();

   const minStake = minStakeFor(betType);
   const couple = betType === "couple_gagnant" || betType === "couple_place";
   const citBlock = citationBlockFor(citations, betType);
   const citRunners = citBlock?.runners.filter((r) => !r.scratched) ?? [];
   const needsRunnersCount = betType === "simple_place";
   const canPickOdds = mode === "cote" && !couple;

   const selectedPlaceReport =
      mode === "cote" && betType === "simple_place" && selectedRunner != null
         ? placeReports.find((p) => p.number === runners[selectedRunner]?.number)
         : undefined;

   let placeReportHint = "Sélectionnez un partant ci-dessus ou saisissez le rapport manuellement.";
   if (prLoading) {
      placeReportHint = "Chargement du rapport probable PMU…";
   } else if (rapport && selectedRunner != null) {
      placeReportHint = selectedPlaceReport
         ? "Rapport probable PMU (non contractuel) — modifiable."
         : "Rapport saisi manuellement — reste modifiable.";
   }

   useEffect(() => {
      if (runners.length > 0) setRunnersCount(String(runners.length));
      setSelectedRunner(null);
   }, [runners]);

   useEffect(() => {
      if (mode === "masses") void reloadCitations();
   }, [mode, reloadCitations]);

   useEffect(() => {
      if (mode === "cote" && betType === "simple_place" && getStoredRace()) {
         void reloadPlaceReports();
      }
   }, [mode, betType, reloadPlaceReports]);

   useEffect(() => {
      if (mode !== "cote" || betType !== "simple_place" || selectedRunner == null) return;
      if (rapport !== "") return;
      const r = runners[selectedRunner];
      const pr = r && placeReports.find((p) => p.number === r.number);
      if (pr) setRapport(medianRapport(pr).toFixed(2));
   }, [placeReports, selectedRunner, betType, mode, runners]);

   useEffect(() => {
      if (mode !== "cote" || betType !== "simple_place" || rapport !== "") return;
      if (selectedRunner != null) return;
      const firstRunnerIndex = runners.findIndex((r) =>
         placeReports.some((p) => p.number === r.number),
      );
      if (firstRunnerIndex === -1) return;
      const r = runners[firstRunnerIndex];
      const pr = placeReports.find((p) => p.number === r.number);
      if (!pr) return;
      setSelectedRunner(firstRunnerIndex);
      setRapport(medianRapport(pr).toFixed(2));
   }, [mode, betType, rapport, runners, placeReports]);

   const pickCitation = (enjeu: number) => {
      if (!citBlock) return;
      setTotalPool(String(citBlock.totalPool));
      setStakeOnSelection(String(enjeu));
   };

   useEffect(() => {
      setSelectedRunner(null);
      setRapport("");
   }, [betType]);

   const pickRunner = (idx: number) => {
      const r = runners[idx];
      if (!r) return;
      setSelectedRunner(idx);
      if (betType === "simple_place") {
         const pr = placeReports.find((p) => p.number === r.number);
         setRapport(pr ? medianRapport(pr).toFixed(2) : "");
      } else if (r.odds) {
         setRapport(r.odds.toFixed(2));
      }
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
                  {betType === "simple_place"
                     ? "Choisir un partant (pré-remplit le rapport probable placé depuis le PMU)"
                     : "Choisir un partant (remplit la cote automatiquement)"}
               </div>
               <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {runners.map((r, i) => {
                     const report =
                        betType === "simple_place"
                           ? placeReports.find((p) => p.number === r.number)
                           : undefined;

                     const runnerLabel = `${r.number} — ${r.name}`;

                     const buttonLabel =
                        betType === "simple_place"
                           ? report
                              ? `${runnerLabel} (${report.minRapport.toFixed(2)} / ${medianRapport(report).toFixed(2)} / ${report.maxRapport.toFixed(2)})`
                              : `${runnerLabel} (rapport indisponible)`
                           : r.odds
                              ? `${runnerLabel} (${r.odds.toFixed(1)})`
                              : runnerLabel;

                     return (
                        <button
                           key={r.number}
                           className={selectedRunner === i ? undefined : "secondary"}
                           style={selectedRunner === i ? { background: "#35c46a", color: "#0b1a10" } : {}}
                           onClick={() => pickRunner(i)}
                        >
                           {buttonLabel}
                        </button>
                     );
                  })}
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
               <label>Type de pari
                  <select value={betType} onChange={(e) => setBetType(e.target.value as BetType)}>
                     {BET_TYPES.map((t) => <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>)}
                  </select>
               </label>
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
                        {placeReportHint}
                     </span>
                  )}
               </div>
            ) : (
               <>
                  <div className="field">
                     <label>Masse totale misée (€)
                        <input type="number" step="100" value={totalPool} onChange={(e) => setTotalPool(e.target.value)} />
                     </label>
                  </div>
                  <div className="field">
                     <label>{couple ? "Enjeu sur la combinaison (€)" : "Enjeu sur le cheval (€)"}
                        <input type="number" step="50" value={stakeOnSelection} onChange={(e) => setStakeOnSelection(e.target.value)} />
                     </label>
                  </div>
                  {needsRunnersCount && (
                     <div className="field">
                        <label>Nombre de partants
                           <input type="number" step="1" min="4" value={runnersCount} onChange={(e) => setRunnersCount(e.target.value)} />
                        </label>
                     </div>
                  )}
               </>
            )}

            <div className="field"><label>&nbsp;<button onClick={run}>Estimer le gain</button></label></div>
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