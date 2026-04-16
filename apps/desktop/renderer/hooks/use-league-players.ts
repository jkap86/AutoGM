'use client'

import { useEffect, useState } from 'react'
import type { LeagueDetailed } from '@sleepier/shared'

type LeaguePlayer = {
  player_id: string
  league_id: string
  metadata: Record<string, unknown> | null
  settings: Record<string, unknown> | null
}

type Result = { league_players: LeaguePlayer[] }

/**
 * Normalized "who likes each player" data per league.
 *   interestByLeague[league_id][player_id] = [roster_id, roster_id, ...]
 *
 * Sleeper stores likes in `metadata.likes` as a comma-separated string of roster_ids,
 * one record per (league_id, player_id). This hook flattens that into a lookup usable
 * anywhere we need to flag trade-target signals.
 */
export type InterestByLeague = Record<string, Record<string, number[]>>

function parseRosterIds(raw: unknown): number[] {
  if (typeof raw !== 'string' || raw.length === 0) return []
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
}

export function useLeaguePlayers(
  leagues: { [league_id: string]: LeagueDetailed } | null | undefined,
  batchSize = 8,
) {
  const [data, setData] = useState<InterestByLeague>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!leagues) return
    const ids = Object.keys(leagues)
    if (ids.length === 0) return

    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      const accum: InterestByLeague = {}
      try {
        for (let i = 0; i < ids.length; i += batchSize) {
          if (cancelled) return
          const chunk = ids.slice(i, i + batchSize)
          const resps = await Promise.all(
            chunk.map((league_id) =>
              window.ipc
                .invoke<Result>('graphql', {
                  name: 'leaguePlayers',
                  vars: { league_id },
                })
                .catch((): Result => ({ league_players: [] })),
            ),
          )
          for (let j = 0; j < chunk.length; j++) {
            const league_id = chunk[j]
            const perPlayer: Record<string, number[]> = {}
            for (const lp of resps[j].league_players) {
              const likes = parseRosterIds(lp.metadata?.likes)
              if (likes.length === 0) continue
              if (!perPlayer[lp.player_id]) perPlayer[lp.player_id] = []
              perPlayer[lp.player_id].push(...likes)
            }
            accum[league_id] = perPlayer
          }
        }
        if (!cancelled) setData(accum)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // Stable key by league_ids — re-fetch only when the set of leagues changes,
    // not on every keystroke elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagues ? Object.keys(leagues).sort().join(',') : ''])

  return { interestByLeague: data, loading, error }
}
