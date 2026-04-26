import { useEffect, useMemo, useState } from 'react'
import type { LeaguesPayload } from '@autogm/shared'
import { deriveCollections } from '@autogm/shared'
import { mobileDataClient } from '../data-client'

export function useLeagues({
  user_id,
  season,
}: {
  user_id: string | null | undefined
  season: string
}) {
  const [data, setData] = useState<LeaguesPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user_id) return

    let cancelled = false
    setLoading(true)
    setError(null)

    mobileDataClient
      .fetchLeagues({ user_id, season })
      .then(
        (payload) => {
          if (cancelled) return
          setData(payload)
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
  }, [user_id, season])

  const { player_shares, leaguemates, pick_shares } = useMemo(
    () => deriveCollections(data ? Object.values(data.leagues) : []),
    [data],
  )

  return {
    user: data?.user ?? null,
    leagues: data?.leagues ?? null,
    playerShares: player_shares,
    leaguemates,
    pickShares: pick_shares,
    loading,
    error,
  }
}
