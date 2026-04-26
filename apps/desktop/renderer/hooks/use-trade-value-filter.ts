'use client'

import { useMemo, useState } from 'react'
import type { Allplayer, LeagueDetailed, Roster } from '@autogm/shared'
import { useKtcByDate } from './use-ktc'
import { useAdp, type AdpFilters } from './use-adp'

export type ValueType = 'ktc' | 'adp' | 'auction'
export const VALUE_TYPES: ValueType[] = ['ktc', 'adp', 'auction']

export type PositionFilter = 'ALL' | 'PLAYERS' | 'PLAYERS+CUR' | 'QB' | 'RB' | 'WR' | 'TE' | 'PICKS'
export const POSITION_FILTERS: PositionFilter[] = ['ALL', 'PLAYERS', 'PLAYERS+CUR', 'QB', 'RB', 'WR', 'TE', 'PICKS']

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

/** Generate a specific pick key like "2026 1.08" for precise lookup */
function specificPickKey(season: string, round: number, order: number): string {
  return `${season} ${round}.${String(order).padStart(2, '0')}`
}

/**
 * Compute pick values for ADP/auction modes based on rookie rankings.
 * For current year: pick N in round R → value of the Nth-ranked rookie in that round's range.
 * For future years: apply a discount ratio derived from KTC current vs future pick values.
 */
function computePickValues(
  adpRows: { player_id: string; adp: number; avg_pct: number | null }[],
  allplayers: { [id: string]: Allplayer },
  valueType: 'adp' | 'auction',
  ktc: Record<string, number>,
  currentSeason: string,
): Record<string, number> {
  const out: Record<string, number> = {}

  // Filter to rookies only (years_exp === 0) and sort by ADP
  const rookies = adpRows
    .filter((r) => {
      const p = allplayers[r.player_id]
      return p && p.years_exp === 0
    })
    .sort((a, b) => a.adp - b.adp)

  if (rookies.length === 0) return out

  // Get value for a rookie at a given rank (0-indexed)
  const rookieValue = (idx: number): number => {
    if (idx >= rookies.length) idx = rookies.length - 1
    const r = rookies[idx]
    if (valueType === 'auction') return (r.avg_pct ?? 0) * 100
    return adpToValue(r.adp)
  }

  // Determine how many rounds we should generate (up to 5)
  const maxRounds = 5
  // Assume ~12 picks per round (standard league size)
  const picksPerRound = 12

  // Populate current season picks
  for (let round = 1; round <= maxRounds; round++) {
    const sfx = round === 1 ? 'st' : round === 2 ? 'nd' : round === 3 ? 'rd' : 'th'
    const baseIdx = (round - 1) * picksPerRound

    // Specific pick keys (e.g., "2026 1.08")
    for (let order = 1; order <= picksPerRound; order++) {
      const idx = baseIdx + order - 1
      const val = rookieValue(idx)
      out[specificPickKey(currentSeason, round, order)] = val
    }

    // Grouped keys (Early/Mid/Late averages)
    const earlyAvg = [1, 2, 3, 4].reduce((s, o) => s + rookieValue(baseIdx + o - 1), 0) / 4
    const midAvg = [5, 6, 7, 8].reduce((s, o) => s + rookieValue(baseIdx + o - 1), 0) / 4
    const lateAvg = [9, 10, 11, 12].reduce((s, o) => s + rookieValue(baseIdx + o - 1), 0) / 4

    out[`${currentSeason} Early ${round}${sfx}`] = earlyAvg
    out[`${currentSeason} Mid ${round}${sfx}`] = midAvg
    out[`${currentSeason} Late ${round}${sfx}`] = lateAvg
  }

  // Future year picks: use KTC ratios to discount
  const currentYear = parseInt(currentSeason, 10)
  for (let yearOffset = 1; yearOffset <= 3; yearOffset++) {
    const futureSeason = String(currentYear + yearOffset)
    for (let round = 1; round <= maxRounds; round++) {
      const sfx = round === 1 ? 'st' : round === 2 ? 'nd' : round === 3 ? 'rd' : 'th'
      const currentKtcKey = `${currentSeason} Mid ${round}${sfx}`
      const futureKtcKey = `${futureSeason} Mid ${round}${sfx}`
      const currentKtcVal = ktc[currentKtcKey] || 0
      const futureKtcVal = ktc[futureKtcKey] || 0
      const ratio = currentKtcVal > 0 ? futureKtcVal / currentKtcVal : 0.5

      // Future picks are all "Mid" (order unknown), so use mid value * ratio
      const currentMidVal = out[`${currentSeason} Mid ${round}${sfx}`] ?? 0
      const futureVal = currentMidVal * ratio

      // Only grouped keys for future (order not determined)
      out[`${futureSeason} Early ${round}${sfx}`] = futureVal
      out[`${futureSeason} Mid ${round}${sfx}`] = futureVal
      out[`${futureSeason} Late ${round}${sfx}`] = futureVal
    }
  }

  return out
}

// Re-export from single source of truth
export { getPickKtcName } from '../lib/trade-utils'
import { getPickKtcName } from '../lib/trade-utils'

function computeRosterValues(
  roster: Roster,
  filter: PositionFilter,
  valueLookup: Record<string, number>,
  allplayers: { [id: string]: Allplayer },
  currentSeason?: string,
): number[] {
  const values: number[] = []
  if (filter !== 'PICKS') {
    for (const pid of roster.players ?? []) {
      const player = allplayers[pid]
      if (!player) continue
      if (filter !== 'ALL' && filter !== 'PLAYERS' && filter !== 'PLAYERS+CUR' && player.position !== filter) continue
      values.push(valueLookup[pid] ?? 0)
    }
  }
  if (filter === 'ALL' || filter === 'PICKS' || filter === 'PLAYERS+CUR') {
    for (const pick of roster.draftpicks ?? []) {
      if (filter === 'PLAYERS+CUR' && pick.season !== currentSeason) continue
      // Try specific key first (e.g., "2026 1.08") for precise valuation
      let val: number | undefined
      if (pick.order && pick.order > 0) {
        val = valueLookup[specificPickKey(pick.season, pick.round, pick.order)]
      }
      // Fall back to grouped name (Early/Mid/Late)
      if (val == null) {
        const name = getPickKtcName(pick.season, pick.round, pick.order)
        val = valueLookup[name] ?? 0
      }
      values.push(val)
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

  // Determine current season from leagues (pick the most common / latest)
  const currentSeason = useMemo(() => {
    const seasons = Object.values(leagues).map((l) => l.season)
    if (seasons.length === 0) return String(new Date().getFullYear())
    return seasons.sort().pop()!
  }, [leagues])

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
    // Add pick values based on rookie ADP/auction rankings
    const pickValues = computePickValues(adpRows, allplayers, valueType, ktc, currentSeason)
    Object.assign(out, pickValues)
    return out
  }, [valueType, ktcDate, today, ktc, ktcHistorical, adpRows, allplayers, currentSeason])

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
          perRoster[r.roster_id] = computeRosterValues(r, filter, valueLookup, allplayers, league.season)
        }
        perFilter[filter] = perRoster
      }
      result[league.league_id] = perFilter
    }
    return result
  }, [leagues, valueLookup, allplayers])

  const sumTopN = (values: number[], n: number) =>
    (n > 0 ? values.slice(0, n) : values).reduce((a, b) => a + b, 0)

  const getValue = (leagueId: string, rosterId: number, filter?: PositionFilter): number => {
    const values = rawByLeague[leagueId]?.[filter ?? positionFilter]?.[rosterId]
    if (!values) return 0
    return sumTopN(values, topN)
  }

  const getRank = (leagueId: string, rosterId: number, filter?: PositionFilter): number | null => {
    const perRoster = rawByLeague[leagueId]?.[filter ?? positionFilter]
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
