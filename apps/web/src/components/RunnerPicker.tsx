import type { RunnerSummary } from "../lib/runner.js";

export default function RunnerPicker({
   runners,
   isSelected,
   onPick,
}: Readonly<{
   runners: RunnerSummary[];
   isSelected: (r: RunnerSummary) => boolean;
   onPick: (r: RunnerSummary) => void;
}>) {
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