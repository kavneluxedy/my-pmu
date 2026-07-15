import { favoriteNumber, oddsGradientColor, oddsRange } from "../lib/oddsColor.js";
import type { RunnerSummary } from "../lib/runner.js";
import OddsBadge from "./OddsBadge.js";

export default function RunnerPicker({
   runners,
   isSelected,
   onPick,
}: Readonly<{
   runners: RunnerSummary[];
   isSelected: (r: RunnerSummary) => boolean;
   onPick: (r: RunnerSummary) => void;
}>) {
   const favNumber = favoriteNumber(runners);
   const range = oddsRange(runners);
   return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
         {runners.map((r) => {
            const selected = isSelected(r);
            return (
               <button
                  key={r.number}
                  className={selected ? undefined : "secondary"}
                  style={{
                     display: "inline-flex",
                     alignItems: "center",
                     gap: 6,
                     ...(selected ? { background: "#35c46a", color: "#0b1a10" } : {}),
                  }}
                  onClick={() => onPick(r)}
               >
                  <span>{r.number} — {r.name}</span>
                  {range && r.odds != null && (
                     <OddsBadge
                        odds={r.odds}
                        color={oddsGradientColor(r.odds, range.min, range.max)}
                        favorite={r.number === favNumber}
                        onDark={selected}
                     />
                  )}
               </button>
            );
         })}
      </div>
   );
}