import type { PlaceReport } from "../api/client.js";
import { medianRapport } from "../lib/placeReport.js";

export default function PlaceRapportInline({ report }: Readonly<{ report: PlaceReport }>) {
   const values: { label: string; value: number; color: string }[] = [
      { label: "Min", value: report.minRapport, color: "var(--danger)" },
      { label: "Méd", value: medianRapport(report), color: "var(--accent)" },
      { label: "Max", value: report.maxRapport, color: "var(--accent-2)" },
   ];
   return (
      <span style={{ display: "inline-flex", gap: 6, fontSize: 11 }}>
         {values.map((v) => (
            <span key={v.label} style={{ color: v.color }}>
               {v.label} {v.value.toFixed(2)}
            </span>
         ))}
      </span>
   );
}
