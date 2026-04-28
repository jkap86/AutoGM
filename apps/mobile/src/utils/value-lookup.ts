import type { AdpRow } from '@autogm/shared'

export type ValueType = 'ktc' | 'adp' | 'auction'

export function adpToValue(adp: number): number {
  return 1000 * Math.exp(-(adp - 1) / 50)
}

export function buildValueLookup(
  valueType: ValueType,
  ktc: Record<string, number>,
  adpRows: AdpRow[],
): Record<string, number> {
  if (valueType === 'ktc') return ktc
  const out: Record<string, number> = {}
  if (valueType === 'adp') {
    for (const r of adpRows) out[r.player_id] = adpToValue(r.adp)
  } else {
    for (const r of adpRows) {
      if (r.avg_pct != null) out[r.player_id] = r.avg_pct * 100
    }
  }
  return out
}

export function formatValue(n: number, valueType: ValueType): string {
  if (valueType === 'auction') return `${n.toFixed(1)}%`
  return Math.round(n).toLocaleString()
}

export function getPickKtcName(season: string, round: number, order: number | null): string {
  const suffix = round === 1 ? 'st' : round === 2 ? 'nd' : round === 3 ? 'rd' : 'th'
  if (order == null || order === 0) return `${season} Mid ${round}${suffix}`
  const type = order <= 4 ? 'Early' : order >= 9 ? 'Late' : 'Mid'
  return `${season} ${type} ${round}${suffix}`
}
