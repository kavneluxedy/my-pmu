import type { CitationBetType } from "../api/client.js";

export default function CitationPicker({
   runners,
   onPick,
}: Readonly<{
   runners: CitationBetType["runners"];
   onPick: (r: CitationBetType["runners"][number]) => void;
}>) {
   return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
         {runners.map((r) => (
            <button key={r.number} className="secondary" onClick={() => onPick(r)}>
               {r.number} — {r.name}
               {r.ratio == null ? "" : ` (${r.ratio.toFixed(2)} %)`}
            </button>
         ))}
      </div>
   );
}