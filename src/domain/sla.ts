import type { SlaState } from './types';
export type SlaStatus = 'ON_TRACK'|'AT_RISK'|'BREACHED'|'COMPLETED';
export const remainingMs = (s: SlaState, now: number) => s.deadline - now;
/** Pure: AT_RISK when <=25% of the target window remains. */
export function slaStatus(s: SlaState, now: number, completedAt?: number): SlaStatus {
  if (completedAt !== undefined) return 'COMPLETED';
  const r = remainingMs(s, now);
  if (r < 0) return 'BREACHED';
  return r <= s.targetMs * 0.25 ? 'AT_RISK' : 'ON_TRACK';
}
export function fmtDuration(ms: number) {
  const neg = ms < 0; const m = Math.floor(Math.abs(ms) / 60000);
  return `${neg ? '-' : ''}${Math.floor(m / 60)}h ${m % 60}m`;
}
