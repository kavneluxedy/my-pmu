/** Arrondit une mise à l'euro le plus proche, sans descendre sous la mise minimale. */
export function roundStakeToEuro(stake: number, minStake: number): number {
  return Math.max(minStake, Math.round(stake));
}
