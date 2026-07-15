import type { CitationBetType } from "../api/client.js";

export default function CitationPicker({
   runners,
   selectedNumber,
   onPick,
}: Readonly<{
   runners: CitationBetType["runners"];
   selectedNumber?: number | null;
   onPick: (r: CitationBetType["runners"][number]) => void;
}>) {
   return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
         {runners.map((r) => {
            const active = r.number === selectedNumber;
            return (
               <button
                  key={r.number}
                  className={active ? undefined : "secondary"}
                  style={active ? { background: "var(--accent)", color: "#0b1a10" } : {}}
                  onClick={() => onPick(r)}
               >
                  {r.number} — {r.name}
                  {r.ratio == null ? "" : ` (${r.ratio.toFixed(2)} %)`}
               </button>
            );
         })}
      </div>
   );
}