import { useState, type ReactNode } from "react";
import type { PlaceReport } from "../api/client.js";
import type { BetType } from "../lib/betTypes.js";
import { favoriteNumber, oddsGradientColor, oddsRange } from "../lib/oddsColor.js";
import type { RunnerSummary } from "../lib/runner.js";
import OddsBadge from "./OddsBadge.js";
import PlaceRapportInline from "./PlaceRapportInline.js";

/**
 * Sélecteur de couplé : coche exactement 2 partants. Au-delà de 2, le plus
 * ancien est remplacé. `onPick` est appelé dans le gestionnaire de clic (et non
 * dans un effet) dès qu'une action aboutit à 2 chevaux sélectionnés, afin de ne
 * PAS re-déclencher l'estimation à chaque rendu (ce qui écraserait une saisie
 * manuelle du rapport/enjeu par l'utilisateur).
 */
export default function CouplePicker({
  runners,
  betType,
  placeReports,
  onPick,
}: Readonly<{
  runners: RunnerSummary[];
  betType: BetType;
  placeReports: PlaceReport[];
  onPick: (pair: [number, number]) => void;
}>) {
  const [selected, setSelected] = useState<number[]>([]);
  const favNumber = favoriteNumber(runners);
  const range = oddsRange(runners);

  const toggleRunner = (runnerNumber: number) => {
    let next: number[];
    if (selected.includes(runnerNumber)) {
      next = selected.filter((n) => n !== runnerNumber); // désélection
    } else if (selected.length < 2) {
      next = [...selected, runnerNumber]; // sélection
    } else {
      next = [selected[1], runnerNumber]; // remplace le plus ancien
    }
    setSelected(next);
    if (next.length === 2) onPick([next[0], next[1]] as [number, number]);
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {runners.map((r) => {
        const isSelected = selected.includes(r.number);
        const report = placeReports.find((p) => p.number === r.number);

        let oddsInfo: ReactNode = null;
        if (betType === "couple_place") {
          oddsInfo = report ? (
            <PlaceRapportInline report={report} />
          ) : (
            <span className="muted" style={{ fontSize: 11 }}>rapport indisponible</span>
          );
        } else if (r.odds != null && range) {
          oddsInfo = (
            <OddsBadge
              odds={r.odds}
              color={oddsGradientColor(r.odds, range.min, range.max)}
              favorite={r.number === favNumber}
              onDark={isSelected}
            />
          );
        }

        return (
          <button
            key={r.number}
            className={isSelected ? undefined : "secondary"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              ...(isSelected ? { background: "#35c46a", color: "#0b1a10" } : {}),
            }}
            onClick={() => toggleRunner(r.number)}
          >
            <span>{r.number} — {r.name}</span>
            {oddsInfo}
          </button>
        );
      })}
    </div>
  );
}
