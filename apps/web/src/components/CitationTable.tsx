import type { CitationBetType } from "../api/client.js";
import { useSortable } from "../hooks/useSortable.js";
import { trjFor, type BetType } from "../lib/betTypes.js";

export default function CitationTable({
   betType,
   block,
}: Readonly<{
   betType: BetType;
   block: CitationBetType;
}>) {
   const trj = trjFor(betType);
   const filtered = block.runners.filter((r) => !r.scratched);
   const { sorted: rows, sort, toggleSort } = useSortable(filtered);

   return (
      <div className="result-box" style={{ marginTop: 12 }}>
         <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Rapports probables (enjeux tous canaux PMU, indicatifs et non contractuels).
         </div>
         <table>
            <thead>
               <tr>
                  <th onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>
                     Partant {sort.key === "name" && (sort.direction === "asc" ? "▲" : "▼")}
                  </th>
                  <th onClick={() => toggleSort("enjeu")} style={{ cursor: "pointer" }}>
                     Enjeu {sort.key === "enjeu" && (sort.direction === "asc" ? "▲" : "▼")}
                  </th>
                  <th onClick={() => toggleSort("ratio")} style={{ cursor: "pointer" }}>
                     Part {sort.key === "ratio" && (sort.direction === "asc" ? "▲" : "▼")}
                  </th>
                  <th>Rapport probable</th>
               </tr>
            </thead>
            <tbody>
               {rows.map((r) => {
                  const rapport = r.enjeu > 0 ? (block.totalPool * trj) / r.enjeu : 0;
                  return (
                     <tr key={r.number} style={r.favoris ? { fontWeight: 600 } : {}}>
                        <td>
                           {r.number} — {r.name}
                           {r.favoris ? " ★" : ""}
                        </td>
                        <td>{r.enjeu.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                        <td>{r.ratio == null ? "—" : `${r.ratio.toFixed(2)} %`}</td>
                        <td>{rapport >= 1 ? `${rapport.toFixed(2)} €` : "—"}</td>
                     </tr>
                  );
               })}
            </tbody>
         </table>
      </div>
   );
}