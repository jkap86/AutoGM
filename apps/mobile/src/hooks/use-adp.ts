import { useCallback, useEffect, useState } from 'react'
import type { AdpFilters, AdpRow } from '@autogm/shared'
import { mobileDataClient } from '../data-client'

export function useAdp(filters: AdpFilters, enabled: boolean = true) {
  const [data, setData] = useState<AdpRow[]>([])
  const [stats, setStats] = useState<{ n_drafts: number; n_leagues: number }>({ n_drafts: 0, n_leagues: 0 })
  const [loading, setLoading] = useState(false)

  const filterKey = JSON.stringify(filters)

  const fetch = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const [rows, statsResult] = await Promise.all([
        mobileDataClient.fetchAdp(filters),
        mobileDataClient.fetchAdpStats(filters),
      ])
      setData(rows)
      setStats(statsResult)
    } catch (e) {
      console.warn('ADP fetch failed:', e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, enabled])

  useEffect(() => { fetch() }, [fetch])

  return { data, stats, loading, refetch: fetch }
}
