/**
 * Coloration des côtes dans les listes de partants : dégradé vert (favori,
 * cote basse) → rouge (outsider, cote haute), plus détection du favori
 * (cote la plus basse) — même calcul que `ImportPmu.tsx` (`RunnersTable`),
 * centralisé ici pour être partagé par les sélecteurs de partants.
 */

const FAVORITE_HUE = 142; // vert (--accent)
const OUTSIDER_HUE = -4; // rouge (--danger)

export function favoriteNumber(runners: { number: number; odds?: number }[]): number | null {
   const eligible = runners.filter((r) => r.odds != null);
   if (eligible.length === 0) return null;
   const minOdds = Math.min(...eligible.map((r) => r.odds as number));
   return eligible.find((r) => r.odds === minOdds)?.number ?? null;
}

export function oddsRange(runners: { odds?: number }[]): { min: number; max: number } | null {
   const values = runners.map((r) => r.odds).filter((o): o is number => o != null);
   if (values.length === 0) return null;
   return { min: Math.min(...values), max: Math.max(...values) };
}

export function oddsGradientColor(odds: number, minOdds: number, maxOdds: number): string {
   if (maxOdds <= minOdds) return "var(--accent)";
   const t = Math.min(1, Math.max(0, (odds - minOdds) / (maxOdds - minOdds)));
   const hue = FAVORITE_HUE - t * (FAVORITE_HUE - OUTSIDER_HUE);
   return `hsl(${hue}, 65%, 55%)`;
}
