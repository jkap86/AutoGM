'use client'

import { useMemo, useState } from 'react'
import type { Allplayer, LeagueDetailed, Roster } from '@sleepier/shared'
import { useKtcByDate } from './use-ktc'
import { useAdp, type AdpFilters } from './use-adp'

export type ValueType = 'ktc' | 'adp' | 'auction'
export const VALUE_TYPES: ValueType[] = ['ktc', 'adp', 'auction']

export type PositionFilter = 'ALL' | 'PLAYERS' | 'QB' | 'RB' | 'WR' | 'TE' | 'PICKS'
export const POSITION_FILTERS: PositionFilter[] = ['ALL', 'PLAYERS', 'QB', 'RB', 'WR', 'TE', 'PICKS']

export type ThresholdFilter = { op: '>=' | '<=' | '>' | '<'; value: number | null }
export const passThreshold = (n: number | null, f: ThresholdFilter): boolean => {
  if (f.value == null) return true
  if (n == null) return false
  switch (f.op) {
    case '>=': return n >= f.value
    case '<=': return n <= f.value
    case '>': return n > f.value
    case '<': return n < f.value
  }
}

// Exponential decay: pick 1 → 1000, pick 10 → ~835, pick 100 → ~145, pick 200 → ~21.
// Gives early-pick gaps much more weight than late-pick gaps, so ADP ranks higher-is-better like KTC/Auction.
function adpToValue(adp: number): number {
  return 1000 * Math.exp(-(adp - 1) / 50)
}

// Re-export from single source of truth
export { getPickKtcName } from '../lib/trade-utils'
import { getPickKtcName } from '../lib/trade-utils'

function computeRosterValues(
  roster: Roster,
  filter: PositionFilter,
  valueLookup: Record<string, number>,
  allplayers: { [id: string]: Allplayer },
): number[] {
  const values: number[] = []
  if (filter !== 'PICKS') {
    for (const pid of roster.players ?? []) {
      const player = allplayers[pid]
      if (!player) continue
      if (filter !== 'ALL' && filter !== 'PLAYERS' && player.position !== filter) continue
      values.push(valueLookup[pid] ?? 0)
    }
  }
  if (filter === 'ALL' || filter === 'PICKS') {
    for (const pick of roster.draftpicks ?? []) {
      const name = getPickKtcName(pick.season, pick.round, pick.order)
      values.push(valueLookup[name] ?? 0)
    }
  }
  return values.sort((a, b) => b - a)
}

export type TradeValueFilter = ReturnType<typeof useTradeValueFilter>

export function useTradeValueFilter({
  leagues,
  allplayers,
  ktc,
}: {
  leagues: { [league_id: string]: LeagueDetailed }
  allplayers: { [id: string]: Allplayer }
  ktc: Record<string, number>
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const defaultAdpStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  }, [])

  const [valueType, setValueType] = useState<ValueType>('ktc')
  const [ktcDate, setKtcDate] = useState<string>(today)
  const [adpFilters, setAdpFilters] = useState<AdpFilters>({
    startDate: defaultAdpStart,
    endDate: today,
    draftType: null,
    leagueTypes: [0, 1, 2],
    bestBall: [0, 1],
    scoringFilters: [],
    settingsFilters: [],
    rosterSlotFilters: [],
    minDrafts: 2,
  })

  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL')
  const [topN, setTopN] = useState<number>(0)

  const [userValueFilter, setUserValueFilter] = useState<ThresholdFilter>({ op: '>=', value: null })
  const [partnerValueFilter, setPartnerValueFilter] = useState<ThresholdFilter>({ op: '>=', value: null })
  const [userRankFilter, setUserRankFilter] = useState<ThresholdFilter>({ op: '<=', value: null })
  const [partnerRankFilter, setPartnerRankFilter] = useState<ThresholdFilter>({ op: '<=', value: null })

  const { ktc: ktcHistorical, loading: ktcLoading } = useKtcByDate(
    valueType === 'ktc' && ktcDate !== today ? ktcDate : null,
  )
  const adpEnabled = valueType === 'adp' || valueType === 'auction'
  const { data: adpRows, stats: adpStats, loading: adpLoading } = useAdp(
    adpFilters,
    adpEnabled,
  )

  const valueLookup = useMemo<Record<string, number>>(() => {
    if (valueType === 'ktc') {
      return ktcDate !== today ? ktcHistorical : ktc
    }
    const out: Record<string, number> = {}
    if (valueType === 'adp') {
      for (const r of adpRows) out[r.player_id] = adpToValue(r.adp)
    } else if (valueType === 'auction') {
      for (const r of adpRows) {
        if (r.avg_pct != null) out[r.player_id] = r.avg_pct * 100
      }
    }
    return out
  }, [valueType, ktcDate, today, ktc, ktcHistorical, adpRows])

  const valueLabel = valueType === 'ktc' ? 'KTC' : valueType === 'adp' ? 'ADP' : 'Auction'

  // Pre-compute sorted per-roster values across ALL leagues so value/rank is available
  // on every tab (potential, pending, completed, rejected).
  const rawByLeague = useMemo(() => {
    const result: Record<string, Record<PositionFilter, Record<number, number[]>>> = {}
    for (const league of Object.values(leagues)) {
      const perFilter = {} as Record<PositionFilter, Record<number, number[]>>
      for (const filter of POSITION_FILTERS) {
        const perRoster: Record<number, number[]> = {}
        for (const r of league.rosters) {
          perRoster[r.roster_id] = computeRosterValues(r, filter, valueLookup, allplayers)
        }
        perFilter[filter] = perRoster
      }
      result[league.league_id] = perFilter
    }
    return result
  }, [leagues, valueLookup, allplayers])

  const sumTopN = (values: number[], n: number) =>
    (n > 0 ? values.slice(0, n) : values).reduce((a, b) => a + b, 0)

  const getValue = (leagueId: string, rosterId: number): number => {
    const values = rawByLeague[leagueId]?.[positionFilter]?.[rosterId]
    if (!values) return 0
    return sumTopN(values, topN)
  }

  const getRank = (leagueId: string, rosterId: number): number | null => {
    const perRoster = rawByLeague[leagueId]?.[positionFilter]
    if (!perRoster) return null
    const totals = Object.entries(perRoster).map(([rid, vals]) => ({
      rid: Number(rid),
      total: sumTopN(vals, topN),
    }))
    totals.sort((a, b) => b.total - a.total)
    const idx = totals.findIndex((t) => t.rid === rosterId)
    return idx >= 0 ? idx + 1 : null
  }

  const auctionFmt = valueType === 'auction' ? (n: number) => `${n.toFixed(1)}%` : undefined
  const formatValue = auctionFmt ?? ((n: number) => Math.round(n).toLocaleString())

  return {
    // State
    valueType, setValueType,
    ktcDate, setKtcDate,
    adpFilters, setAdpFilters,
    positionFilter, setPositionFilter,
    topN, setTopN,
    userValueFilter, setUserValueFilter,
    partnerValueFilter, setPartnerValueFilter,
    userRankFilter, setUserRankFilter,
    partnerRankFilter, setPartnerRankFilter,
    // Meta
    loading: ktcLoading || adpLoading,
    adpStats,
    today,
    // Derived
    valueLookup,
    valueLabel,
    auctionFmt,
    formatValue,
    getValue,
    getRank,
  }
}
