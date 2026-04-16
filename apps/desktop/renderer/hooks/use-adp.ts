'use client'

import { useCallback, useEffect, useState } from 'react'

export type AdpFilters = {
  startDate?: string | null
  endDate?: string | null
  draftType?: 'snake' | 'auction' | 'linear' | null
  leagueTypes?: number[]
  bestBall?: number[]
  season?: string | null
  scoringFilters?: { key: string; operator: string; value: number }[]
  settingsFilters?: { key: string; operator: string; value: number }[]
  rosterSlotFilters?: { position: string; operator: string; count: number }[]
  minDrafts?: number
}

export type AdpRow = {
  player_id: string
  adp: number
  min_pick: number
  max_pick: number
  stdev: number | null
  n_drafts: number
  n_auctions: number
  avg_pct: number | null
  min_pct: number | null
  max_pct: number | null
}

export function useAdp(filters: AdpFilters, enabled: boolean = true) {
  const [data, setData] = useState<AdpRow[]>([])
  const [stats, setStats] = useState<{ n_drafts: number; n_leagues: number }>({ n_drafts: 0, n_leagues: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const fetch = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const [rows, statsResult] = await Promise.all([
        window.ipc.invoke<AdpRow[]>('adp:fetch', filters),
        window.ipc.invoke<{ n_drafts: number; n_leagues: number }>('adp:stats', filters),
      ])
      setData(rows)
      setStats(statsResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, enabled])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, stats, loading, error, refetch: fetch }
}
