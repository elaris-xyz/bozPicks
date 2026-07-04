import type { ParimutuelPool, Outcome } from '../types';

export function estimatePayout(
  userStake: number,
  userOutcome: Outcome,
  pool: ParimutuelPool
): number {
  const key = userOutcome.toLowerCase() as 'home' | 'draw' | 'away';
  const outcomePool = pool.pools[key];
  const newOutcomePool = outcomePool + userStake;
  const newTotal = pool.totalPool + userStake;
  const afterFee = newTotal * (1 - pool.feeBps / 10_000);
  return (userStake / newOutcomePool) * afterFee;
}

export function poolSharePercent(
  pool: ParimutuelPool,
  outcome: Outcome
): number {
  if (pool.totalPool === 0) return 33.33;
  const key = outcome.toLowerCase() as 'home' | 'draw' | 'away';
  return (pool.pools[key] / pool.totalPool) * 100;
}

export function usdcToDisplay(microUnits: number): string {
  return (microUnits / 1_000_000).toFixed(2);
}

export function displayToUsdc(amount: number): number {
  return Math.floor(amount * 1_000_000);
}
