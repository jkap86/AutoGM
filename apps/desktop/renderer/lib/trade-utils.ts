/**
 * Shared utility functions for trade views.
 * Single source of truth for formatRecord, getPickKtcName, formatPick, etc.
 */

export function formatRecord(r: { wins: number; losses: number; ties: number }): string {
  return r.ties > 0
    ? `${r.wins}-${r.losses}-${r.ties}`
    : `${r.wins}-${r.losses}`;
}

export function getPickKtcName(season: string, round: number, order: number | null): string {
  const suffix = round === 1 ? "st" : round === 2 ? "nd" : round === 3 ? "rd" : "th";
  if (order == null || order === 0) return `${season} Mid ${round}${suffix}`;
  const type = order <= 4 ? "Early" : order >= 9 ? "Late" : "Mid";
  return `${season} ${type} ${round}${suffix}`;
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
