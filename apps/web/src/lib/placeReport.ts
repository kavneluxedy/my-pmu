import type { PlaceReport } from "../api/client.js";

export function medianRapport(pr: PlaceReport): number {
   return (pr.minRapport + pr.maxRapport) / 2;
}
