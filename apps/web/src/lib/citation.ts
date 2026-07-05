import type { CitationBetType, ProviderCitations } from "../api/client.js";
import type { BetType } from "./betTypes.js";

export function citationBlockFor(
  citations: ProviderCitations | null,
  betType: BetType,
): CitationBetType | undefined {
  return citations?.betTypes.find(
    (b) => b.betType === betType && !b.indisponible && b.runners.length > 0,
  );
}