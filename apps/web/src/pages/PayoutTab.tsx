import { useEffect, useRef, useState } from "react";
import {
   api,
   type PayoutResult,
} from "../api/client.js";
import AddToBetsButton from "../components/AddToBetsButton.js";
import CitationPicker from "../components/CitationPicker.js";
import CitationTable from "../components/CitationTable.js";
import CouplePicker from "../components/CouplePicker.js";
import OddsBadge from "../components/OddsBadge.js";
import { useCitations } from "../hooks/useCitations.js";
import { usePlaceReports } from "../hooks/usePlaceReports.js";
import { useCoupleReports } from "../hooks/useCoupleReports.js";
import { BET_TYPE_LABELS, BET_TYPES, minStakeFor, type BetType } from "../lib/betTypes.js";
import { citationBlockFor } from "../lib/citation.js";
import { favoriteNumber, oddsGradientColor, oddsRange } from "../lib/oddsColor.js";
import { medianRapport } from "../lib/placeReport.js";
import type { RunnerSummary } from "../lib/runner.js";
import { getStoredRace } from "../raceStore.js";

export default function PayoutTab({ runners }: Readonly<{ runners: RunnerSummary[] }>) {
   const [betType, setBetType] = useState<BetType>(BET_TYPES[0]);
   const [mode, setMode] = useState<"cote" | "masses">("cote");
   const [stake, setStake] = useState("2");
   const [rapport, setRapport] = useState("4.5");
   const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
   const [selectedRapportKind, setSelectedRapportKind] = useState<"min" | "median" | "max" | null>(null);
   const [totalPool, setTotalPool] = useState("10000");
   const [stakeOnSelection, setStakeOnSelection] = useState("1000");
   const [runnersCount, setRunnersCount] = useState(() =>
      runners.length > 0 ? String(runners.length) : "12",
   );
   const [result, setResult] = useState<PayoutResult | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [usesCouplePlaceFallback, setUsesCouplePlaceFallback] = useState(false);

   const { citations, loading: citLoading, error: citError, reload: reloadCitations } =
      useCitations();
   const { reports: placeReports, loading: prLoading, reload: reloadPlaceReports } =
      usePlaceReports();
   const { coupleReports, loading: coupleLoading, error: coupleError, reload: reloadCoupleReports } =
      useCoupleReports();

   const minStake = minStakeFor(betType);
   const couple = betType === "couple_gagnant" || betType === "couple_place";
   const citBlock = citationBlockFor(citations, betType);
   const citRunners = citBlock?.runners.filter((r) => !r.scratched) ?? [];
   const needsRunnersCount = betType === "simple_place";
   const canPickOdds = mode === "cote" && !couple;

   // Tous les partants actifs (non-scratched), indépendamment de la disponibilité
   // de la cote. `runners` (prop) est filtré par le parent `Simulator.tsx` sur
   // `odds != null` (pour Dutching/ValueBet qui en ont besoin), mais Payout doit
   // afficher les partants même sans cote — on recalcule la liste ici en amont,
   // depuis la course en store (source de vérité pour tous les partants réels).
   // Fallback vers la prop `runners` (déjà filtrée à minima) si aucune course n'est
   // en session (ex: juste après un import, avant la première actualisation).
   const storedRaceRunners = getStoredRace()?.race.runners.filter((r) => !r.scratched) ?? [];
   const allAvailableRunners: RunnerSummary[] =
      storedRaceRunners.length > 0 ? storedRaceRunners : runners;

   const favNumber = favoriteNumber(allAvailableRunners);
   const oddsRangeForRunners = oddsRange(allAvailableRunners);

   const selectedPlaceReport =
      mode === "cote" && betType === "simple_place" && selectedNumber != null
         ? placeReports.find((p) => p.number === selectedNumber)
         : undefined;

   let placeReportHint = "Sélectionnez un partant ci-dessus ou saisissez le rapport manuellement.";
   if (prLoading) {
      placeReportHint = "Chargement du rapport probable PMU…";
   } else if (rapport && selectedNumber != null) {
      placeReportHint = selectedPlaceReport
         ? "Rapport probable PMU (non contractuel) — modifiable."
         : "Rapport saisi manuellement — reste modifiable.";
   }

   useEffect(() => {
      if (allAvailableRunners.length > 0) setRunnersCount(String(allAvailableRunners.length));
   }, [allAvailableRunners]);

   // Purge la sélection seulement si le partant a réellement disparu (non-partant,
   // course changée). On NE réinitialise PAS à chaque rafraîchissement des cotes,
   // pour que le pick de l'utilisateur reste visible et stable.
   useEffect(() => {
      if (selectedNumber != null && !allAvailableRunners.some((r) => r.number === selectedNumber)) {
         setSelectedNumber(null);
         setSelectedRapportKind(null);
      }
   }, [allAvailableRunners, selectedNumber]);

   useEffect(() => {
      if (mode === "masses") void reloadCitations();
   }, [mode, reloadCitations]);

   useEffect(() => {
      if ((betType === "couple_gagnant" || betType === "couple_place") && getStoredRace()) {
         void reloadCoupleReports();
      }
   }, [betType, reloadCoupleReports]);

   // Simple Placé : le rapport probable PMU n'est utilisé qu'en mode « cote »
   // (pré-remplissage) ; en mode « masses », inutile de l'interroger. Couplé
   // Placé, lui, affiche le rapport individuel à côté de l'enjeu dans les deux
   // modes (CouplePicker), donc on le charge dans tous les cas.
   useEffect(() => {
      if (!getStoredRace()) return;
      if (betType === "couple_place" || (betType === "simple_place" && mode === "cote")) {
         void reloadPlaceReports();
      }
   }, [betType, mode, reloadPlaceReports]);

   useEffect(() => {
      if (mode !== "cote" || betType !== "simple_place" || selectedNumber == null) return;
      if (rapport !== "") return;
      const pr = placeReports.find((p) => p.number === selectedNumber);
      if (pr) {
         setRapport(medianRapport(pr).toFixed(2));
         setSelectedRapportKind("median");
      }
   }, [placeReports, selectedNumber, betType, mode]);

   useEffect(() => {
      if (mode !== "cote" || betType !== "simple_place" || rapport !== "") return;
      if (selectedNumber != null) return;
      const r = allAvailableRunners.find((x) => placeReports.some((p) => p.number === x.number));
      if (!r) return;
      const pr = placeReports.find((p) => p.number === r.number);
      if (!pr) return;
      setSelectedNumber(r.number);
      setSelectedRapportKind("median");
      setRapport(medianRapport(pr).toFixed(2));
   }, [mode, betType, rapport, allAvailableRunners, placeReports, selectedNumber]);

   const pickCitation = (number: number, enjeu: number) => {
      if (!citBlock) return;
      setSelectedNumber(number);
      setTotalPool(String(citBlock.totalPool));
      setStakeOnSelection(String(enjeu));
   };

   // Ne réinitialise la sélection/le rapport que lors d'un VRAI changement de
   // type de pari (comparaison à la valeur précédente, pas un simple flag
   // « premier rendu » : React.StrictMode double-invoque les effets en dev,
   // ce qui consommerait un flag « premier rendu » dès le montage et
   // déclencherait quand même la réinitialisation, effaçant "4.5").
   const prevBetType = useRef(betType);
   useEffect(() => {
      if (prevBetType.current === betType) return;
      prevBetType.current = betType;
      setSelectedNumber(null);
      setSelectedRapportKind(null);
      setRapport("");
   }, [betType]);

   const pickCouple = (pair: [number, number]) => {
      const key = [pair[0], pair[1]].sort((a, b) => a - b).join("-");

      if (betType === "couple_gagnant") {
         // Mode cote : chercher le rapport dans coupleReports
         if (coupleReports?.gagnant) {
            const report = coupleReports.gagnant.find(
               (r) => [r.pair[0], r.pair[1]].sort((a, b) => a - b).join("-") === key
            );
            if (report) {
               setMode("cote");
               setRapport(String(report.rapportDirect));
               setUsesCouplePlaceFallback(false);
               return;
            }
         }
         // Fallback : rapport indisponible
         setMode("cote");
         setRapport("");
         setUsesCouplePlaceFallback(false);
      } else if (betType === "couple_place") {
         // Mode masses : chercher l'enjeu dans les combinaisons
         if (coupleReports?.placeMasses) {
            const combo = coupleReports.placeMasses.combinations.find(
               (c) => [...c.pair].sort((a, b) => a - b).join("-") === key
            );
            if (combo) {
               setMode("masses");
               setTotalPool(String(coupleReports.placeMasses.totalPool));
               setStakeOnSelection(String(combo.enjeu));
               setUsesCouplePlaceFallback(false);
               return;
            }
            // Fallback : reconstruire l'enjeu par cheval
            if (citBlock && citRunners.length > 0) {
               const rA = citRunners.find((r) => r.number === pair[0]);
               const rB = citRunners.find((r) => r.number === pair[1]);
               if (rA && rB) {
                  const T = citBlock.totalPool;
                  const eA = rA.enjeu;
                  const eB = rB.enjeu;
                  const enjeuPair = Math.round(
                     (coupleReports.placeMasses.totalPool * (eA / T) * (eB / T) * 2)
                  );
                  setMode("masses");
                  setTotalPool(String(coupleReports.placeMasses.totalPool));
                  setStakeOnSelection(String(enjeuPair));
                  setUsesCouplePlaceFallback(true);
                  return;
               }
            }
         }
         // Fallback ultime : mode masses vide
         setMode("masses");
         setTotalPool(String(coupleReports?.placeMasses.totalPool ?? 0));
         setStakeOnSelection("10");
         setUsesCouplePlaceFallback(true);
      }
   };

   const pickRunnerValue = (r: RunnerSummary, kind: "min" | "median" | "max", value: number) => {
      setSelectedNumber(r.number);
      setSelectedRapportKind(kind);
      setRapport(value.toFixed(2));
   };

   const pickRunnerOdds = (r: RunnerSummary) => {
      setSelectedNumber(r.number);
      setSelectedRapportKind(null);
      if (r.odds) setRapport(r.odds.toFixed(2));
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

         {canPickOdds && allAvailableRunners.length > 0 && (
            <div style={{ marginBottom: 14 }}>
               <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  {betType === "simple_place"
                     ? "Choisir un partant (pré-remplit le rapport probable placé depuis le PMU)"
                     : "Choisir un partant (remplit la cote automatiquement)"}
               </div>
               <div style={{ display: "flex", flexWrap: "wrap", gap: betType === "simple_place" ? 10 : 6 }}>
                  {allAvailableRunners.map((r) => {
                     const runnerLabel = `${r.number} — ${r.name}`;

                     if (betType === "simple_place") {
                        const report = placeReports.find((p) => p.number === r.number);
                        if (!report) {
                           return (
                              <span key={r.number} className="muted" style={{ fontSize: 12 }}>
                                 {runnerLabel} (rapport indisponible)
                              </span>
                           );
                        }
                        const values: { kind: "min" | "median" | "max"; label: string; value: number; color: string }[] = [
                           { kind: "min", label: "Min", value: report.minRapport, color: "var(--danger)" },
                           { kind: "median", label: "Méd", value: medianRapport(report), color: "var(--accent)" },
                           { kind: "max", label: "Max", value: report.maxRapport, color: "var(--accent-2)" },
                        ];
                        return (
                           <div key={r.number} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 13 }}>
                                 {r.number === favNumber && "★ "}
                                 {runnerLabel}
                              </span>
                              {values.map((v) => {
                                 const active = selectedNumber === r.number && selectedRapportKind === v.kind;
                                 return (
                                    <button
                                       key={v.kind}
                                       className="secondary"
                                       style={{
                                          borderColor: v.color,
                                          color: active ? "#0b1a10" : v.color,
                                          background: active ? v.color : "transparent",
                                       }}
                                       onClick={() => pickRunnerValue(r, v.kind, v.value)}
                                    >
                                       {v.label} {v.value.toFixed(2)}
                                    </button>
                                 );
                              })}
                           </div>
                        );
                     }

                     const active = selectedNumber === r.number;

                     return (
                        <button
                           key={r.number}
                           className={active ? undefined : "secondary"}
                           style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              ...(active ? { background: "var(--accent)", color: "#0b1a10" } : {}),
                           }}
                           onClick={() => pickRunnerOdds(r)}
                        >
                           <span>{runnerLabel}</span>
                           {r.odds != null && oddsRangeForRunners && (
                              <OddsBadge
                                 odds={r.odds}
                                 color={oddsGradientColor(r.odds, oddsRangeForRunners.min, oddsRangeForRunners.max)}
                                 favorite={r.number === favNumber}
                                 onDark={active}
                              />
                           )}
                        </button>
                     );
                  })}
               </div>
            </div>
         )}

         {couple && mode === "cote" && getStoredRace() && (
            <div style={{ marginBottom: 14 }}>
               <div
                  className="muted"
                  style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, marginBottom: 6 }}
               >
                  <span>
                     {coupleLoading
                        ? "Chargement des rapports Couplé…"
                        : coupleError
                           ? `Rapports Couplé indisponibles : ${coupleError}`
                           : allAvailableRunners.length > 0
                              ? "Choisir 2 partants (remplit le rapport depuis le PMU)"
                              : "Aucune donnée disponible"}
                  </span>
                  {!coupleLoading && (
                     <button
                        className="secondary"
                        onClick={() => void reloadCoupleReports()}
                        disabled={coupleLoading}
                        style={{ whiteSpace: "nowrap" }}
                     >
                        ↻ Actualiser
                     </button>
                  )}
               </div>
               {allAvailableRunners.length > 0 && (
                  <CouplePicker
                     runners={allAvailableRunners}
                     betType={betType}
                     placeReports={placeReports}
                     onPick={pickCouple}
                  />
               )}
               {betType === "couple_gagnant" && coupleReports?.gagnant.length === 0 && (
                  <div style={{ marginTop: 10 }}>
                     <p className="muted">Couplé Gagnant non proposé sur cette course.</p>
                  </div>
               )}
            </div>
         )}

         {couple && mode === "masses" && getStoredRace() && (
            <div style={{ marginBottom: 14 }}>
               <div
                  className="muted"
                  style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, marginBottom: 6 }}
               >
                  <span>
                     {coupleLoading
                        ? "Chargement des combinaisons…"
                        : coupleError
                           ? `Données indisponibles : ${coupleError}`
                           : allAvailableRunners.length > 0
                              ? "Choisir 2 partants (remplit l'enjeu depuis les données réelles PMU)"
                              : "Aucune donnée disponible"}
                  </span>
                  {!coupleLoading && (
                     <button
                        className="secondary"
                        onClick={() => void reloadCoupleReports()}
                        disabled={coupleLoading}
                        style={{ whiteSpace: "nowrap" }}
                     >
                        ↻ Actualiser
                     </button>
                  )}
               </div>
               {allAvailableRunners.length > 0 && (
                  <CouplePicker
                     runners={allAvailableRunners}
                     betType={betType}
                     placeReports={placeReports}
                     onPick={pickCouple}
                  />
               )}
               {betType === "couple_place" && coupleReports?.placeMasses.totalPool === 0 && (
                  <div style={{ marginTop: 10 }}>
                     <p className="muted">Couplé Placé non proposé sur cette course.</p>
                  </div>
               )}
            </div>
         )}

         {!couple && mode === "masses" && getStoredRace() && (
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
                  <CitationPicker
                     runners={citRunners}
                     selectedNumber={selectedNumber}
                     onPick={(r) => pickCitation(r.number, r.enjeu)}
                  />
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
                  <label>{betType === "simple_place" ? "Rapport placé pour 1 €" : betType === "couple_gagnant" ? "Rapport Couplé Gagnant pour 1 €" : "Cote / rapport pour 1 €"}</label>
                  <input type="number" step="0.1" min="1" value={rapport} onChange={(e) => setRapport(e.target.value)} />
                  {betType === "simple_place" && (
                     <span className="muted" style={{ position: "absolute", top: "100%", left: 0, marginTop: 3, fontSize: 11 }}>
                        {placeReportHint}
                     </span>
                  )}
                  {betType === "couple_gagnant" && rapport && (
                     <span className="muted" style={{ position: "absolute", top: "100%", left: 0, marginTop: 3, fontSize: 11 }}>
                        Rapport probable Couplé PMU (exact, non contractuel) — modifiable.
                     </span>
                  )}
                  {betType === "couple_gagnant" && !rapport && (
                     <span className="muted" style={{ position: "absolute", top: "100%", left: 0, marginTop: 3, fontSize: 11 }}>
                        Rapport indisponible pour cette paire (saisie manuelle).
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

         {couple && betType === "couple_place" && mode === "masses" && (coupleReports?.placeMasses?.totalPool ?? 0) > 0 && (
            <div style={{ marginTop: 14 }}>
               {usesCouplePlaceFallback ? (
                  <div className="warn">
                     Paire hors des plus jouées : masse reconstruite depuis les enjeux par cheval — estimation <strong>TRÈS approximative</strong>.
                  </div>
               ) : (
                  <div className="info">
                     Enjeu exact du bloc Couplé Placé — estimation <strong>±30 %</strong> (pari mutuel).
                  </div>
               )}
            </div>
         )}

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
               <div style={{ marginTop: 12 }}>
                  <AddToBetsButton
                     label="🎫 Ajouter à Mes paris"
                     defaultStake={result.stake}
                     minStake={minStakeFor(betType)}
                     disabled={result.rapportBrutPourUnEuro <= 0}
                     getDraft={(date, stake) => {
                        const stored = getStoredRace();
                        const ctx = stored ? `R${stored.race.reunion}C${stored.race.course} - ` : "";
                        const who = selectedNumber != null ? `n°${selectedNumber}` : BET_TYPE_LABELS[betType];
                        return {
                           date,
                           betType,
                           label: `${ctx}${who}`,
                           stake,
                           odds: Number(result.rapportBrutPourUnEuro.toFixed(2)),
                        };
                     }}
                  />
               </div>
            </div>
         )}

         {mode === "masses" && citRunners.length > 0 && (
            <CitationTable betType={betType} block={citBlock!} />
         )}
      </div>
   );
}