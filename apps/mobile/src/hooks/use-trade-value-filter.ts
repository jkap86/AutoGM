import { useMemo, useState, useCallback, useEffect } from 'react'
import type { Allplayer, LeagueDetailed, Roster, AdpFilters, AdpRow } from '@autogm/shared'
import { useKtc } from './use-ktc'
import { useAdp } from './use-adp'
import { useAuth } from '@autogm/shared/react'
import { mobileDataClient } from '../data-client'
import { getPickKtcName } from '../utils/value-lookup'

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

function adpToValue(adp: number): number {
  return 1000 * Math.exp(-(adp - 1) / 50)
}

function specificPickKey(season: string, round: number, order: number): string {
  return `${season} ${round}.${String(order).padStart(2, '0')}`
}

function computePickValues(
  adpRows: AdpRow[],
  allplayers: { [id: string]: Allplayer },
  valueType: 'adp' | 'auction',
  ktc: Record<string, number>,
  currentSeason: string,
): Record<string, number> {
  const out: Record<string, number> = {}

  const rookies = adpRows
    .filter((r) => {
      const p = allplayers[r.player_id]
      return p && p.years_exp === 0
    })
    .sort((a, b) => a.adp - b.adp)

  if (rookies.length === 0) return out

  const rookieValue = (idx: number): number => {
    if (idx >= rookies.length) idx = rookies.length - 1
    const r = rookies[idx]
    if (valueType === 'auction') return (r.avg_pct ?? 0) * 100
    return adpToValue(r.adp)
  }

  const maxRounds = 5
  const picksPerRound = 12

  for (let round = 1; round <= maxRounds; round++) {
    const sfx = round === 1 ? 'st' : round === 2 ? 'nd' : round === 3 ? 'rd' : 'th'
    const baseIdx = (round - 1) * picksPerRound

    for (let order = 1; order <= picksPerRound; order++) {
      out[specificPickKey(currentSeason, round, order)] = rookieValue(baseIdx + order - 1)
    }

    const earlyAvg = [1, 2, 3, 4].reduce((s, o) => s + rookieValue(baseIdx + o - 1), 0) / 4
    const midAvg = [5, 6, 7, 8].reduce((s, o) => s + rookieValue(baseIdx + o - 1), 0) / 4
    const lateAvg = [9, 10, 11, 12].reduce((s, o) => s + rookieValue(baseIdx + o - 1), 0) / 4

    out[`${currentSeason} Early ${round}${sfx}`] = earlyAvg
    out[`${currentSeason} Mid ${round}${sfx}`] = midAvg
    out[`${currentSeason} Late ${round}${sfx}`] = lateAvg
  }

  const currentYear = parseInt(currentSeason, 10)
  for (let yearOffset = 1; yearOffset <= 3; yearOffset++) {
    const futureSeason = String(currentYear + yearOffset)
    for (let round = 1; round <= maxRounds; round++) {
      const sfx = round === 1 ? 'st' : round === 2 ? 'nd' : round === 3 ? 'rd' : 'th'

      for (const tier of ['Early', 'Mid', 'Late'] as const) {
        const currentKtcKey = `${currentSeason} ${tier} ${round}${sfx}`
        const futureKtcKey = `${futureSeason} ${tier} ${round}${sfx}`
        const currentKtcVal = ktc[currentKtcKey] || ktc[`${currentSeason} Mid ${round}${sfx}`] || 0
        const futureKtcVal = ktc[futureKtcKey] || ktc[`${futureSeason} Mid ${round}${sfx}`] || 0
        const ratio = currentKtcVal > 0 ? futureKtcVal / currentKtcVal : 0.5
        out[`${futureSeason} ${tier} ${round}${sfx}`] = (out[`${currentSeason} ${tier} ${round}${sfx}`] ?? 0) * ratio
      }

      const currentMidKtcVal = ktc[`${currentSeason} Mid ${round}${sfx}`] || 0
      const futureMidKtcVal = ktc[`${futureSeason} Mid ${round}${sfx}`] || 0
      const midRatio = currentMidKtcVal > 0 ? futureMidKtcVal / currentMidKtcVal : 0.5
      for (let order = 1; order <= picksPerRound; order++) {
        out[specificPickKey(futureSeason, round, order)] = (out[specificPickKey(currentSeason, round, order)] ?? 0) * midRatio
      }
    }
  }

  return out
}

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
      let val: number | undefined
      if (pick.order && pick.order > 0) {
        val = valueLookup[specificPickKey(pick.season, pick.round, pick.order)]
      }
      if (val == null) {
        val = valueLookup[getPickKtcName(pick.season, pick.round, pick.order)] ?? 0
      }
      values.push(val)
    }
  }
  return values.sort((a, b) => b - a)
}

function useKtcByDate(date: string | null) {
  const [ktc, setKtc] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!date) return
    setLoading(true)
    mobileDataClient.fetchKtcByDate(date)
      .then((data) => setKtc(data.player_values))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [date])

  return { ktc, loading }
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
  const { data: adpRows, stats: adpStats, loading: adpLoading } = useAdp(adpFilters, adpEnabled)

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
    const pickValues = computePickValues(adpRows, allplayers, valueType, ktc, currentSeason)
    Object.assign(out, pickValues)
    return out
  }, [valueType, ktcDate, today, ktc, ktcHistorical, adpRows, allplayers, currentSeason])

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

  const getValue = useCallback((leagueId: string, rosterId: number, filter?: PositionFilter, n?: number): number => {
    const values = rawByLeague[leagueId]?.[filter ?? positionFilter]?.[rosterId]
    if (!values) return 0
    return sumTopN(values, n ?? topN)
  }, [rawByLeague, positionFilter, topN])

  const getRank = useCallback((leagueId: string, rosterId: number, filter?: PositionFilter, n?: number): number | null => {
    const perRoster = rawByLeague[leagueId]?.[filter ?? positionFilter]
    if (!perRoster) return null
    const effectiveN = n ?? topN
    const totals = Object.entries(perRoster).map(([rid, vals]) => ({
      rid: Number(rid),
      total: sumTopN(vals, effectiveN),
    }))
    totals.sort((a, b) => b.total - a.total)
    const idx = totals.findIndex((t) => t.rid === rosterId)
    return idx >= 0 ? idx + 1 : null
  }, [rawByLeague, positionFilter, topN])

  const formatValue = valueType === 'auction'
    ? (n: number) => `${n.toFixed(1)}%`
    : (n: number) => Math.round(n).toLocaleString()

  return {
    valueType, setValueType,
    ktcDate, setKtcDate,
    adpFilters, setAdpFilters,
    positionFilter, setPositionFilter,
    topN, setTopN,
    userValueFilter, setUserValueFilter,
    partnerValueFilter, setPartnerValueFilter,
    userRankFilter, setUserRankFilter,
    partnerRankFilter, setPartnerRankFilter,
    loading: ktcLoading || adpLoading,
    adpStats,
    today,
    valueLookup,
    formatValue,
    getValue,
    getRank,
  }
}
