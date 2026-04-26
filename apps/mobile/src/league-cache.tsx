import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import type { LeaguesPayload, LeagueDetailed, User, PlayerShares, Leaguemates, PickShares } from '@autogm/shared'
import { deriveCollections, CURRENT_SEASON } from '@autogm/shared'
import { useAuth } from '@autogm/shared/react'
import { mobileDataClient } from './data-client'

type LeagueCacheValue = {
  user: User | null
  leagues: { [league_id: string]: LeagueDetailed } | null
  playerShares: PlayerShares
  leaguemates: Leaguemates
  pickShares: PickShares
  loading: boolean
  error: string | null
  refetch: () => void
}

const LeagueCacheContext = createContext<LeagueCacheValue | null>(null)

export function LeagueCacheProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const user_id = session?.user_id
  const [data, setData] = useState<LeaguesPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLeagues = useCallback(async () => {
    if (!user_id) return
    setLoading(true)
    setError(null)
    try {
      const payload = await mobileDataClient.fetchLeagues({ user_id, season: CURRENT_SEASON })
      setData(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [user_id])

  useEffect(() => {
    fetchLeagues()
  }, [fetchLeagues])

  const { player_shares, leaguemates, pick_shares } = useMemo(
    () => deriveCollections(data ? Object.values(data.leagues) : []),
    [data],
  )

  const value: LeagueCacheValue = useMemo(
    () => ({
      user: data?.user ?? null,
      leagues: data?.leagues ?? null,
      playerShares: player_shares,
      leaguemates,
      pickShares: pick_shares,
      loading,
      error,
      refetch: fetchLeagues,
    }),
    [data, player_shares, leaguemates, pick_shares, loading, error, fetchLeagues],
  )

  return (
    <LeagueCacheContext.Provider value={value}>
      {children}
    </LeagueCacheContext.Provider>
  )
}

export function useLeagueCache(): LeagueCacheValue {
  const ctx = useContext(LeagueCacheContext)
  if (!ctx) {
    throw new Error('useLeagueCache must be used within a LeagueCacheProvider')
  }
  return ctx
}
