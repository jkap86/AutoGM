import { useEffect, useMemo, useState } from 'react'
import type { Allplayer } from '@sleepier/shared'
import { mobileDataClient } from '../data-client'

export function useAllPlayers() {
  const [data, setData] = useState<Allplayer[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    mobileDataClient.fetchAllPlayers().then(
      (allplayers) => {
        if (cancelled) return
        setData(allplayers)
        setLoading(false)
      },
      (e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  const allplayers = useMemo(() => {
    if (!data) return {}
    return Object.fromEntries(data.map((p) => [p.player_id, p]))
  }, [data])

  return { allplayers, loading, error }
}
