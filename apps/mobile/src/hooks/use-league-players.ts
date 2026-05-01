import { useEffect, useMemo, useState } from 'react'
import type { LeagueDetailed } from '@autogm/shared'
import { mobileDataClient } from '../data-client'

type LeaguePlayer = {
  player_id: string
  league_id: string
  metadata: Record<string, unknown> | null
  settings: Record<string, unknown> | null
}

type Result = { league_players: LeaguePlayer[] }

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
  const [interest, setInterest] = useState<InterestByLeague>({})
  const [tradeBlock, setTradeBlock] = useState<InterestByLeague>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const leagueKey = useMemo(() => leagues ? Object.keys(leagues).sort().join(',') : '', [leagues])

  useEffect(() => {
    if (!leagues) return
    const ids = Object.keys(leagues)
    if (ids.length === 0) return

    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      const interestAccum: InterestByLeague = {}
      const tbAccum: InterestByLeague = {}
      try {
        for (let i = 0; i < ids.length; i += batchSize) {
          if (cancelled) return
          const chunk = ids.slice(i, i + batchSize)
          const resps = await Promise.all(
            chunk.map((league_id) =>
              mobileDataClient
                .graphql('leaguePlayers', { league_id })
                .catch((): Result => ({ league_players: [] })),
            ),
          )
          for (let j = 0; j < chunk.length; j++) {
            const league_id = chunk[j]
            const perPlayerLikes: Record<string, number[]> = {}
            const perPlayerTB: Record<string, number[]> = {}
            for (const lp of (resps[j] as Result).league_players) {
              const likes = parseRosterIds(lp.metadata?.likes)
              if (likes.length > 0) {
                if (!perPlayerLikes[lp.player_id]) perPlayerLikes[lp.player_id] = []
                perPlayerLikes[lp.player_id].push(...likes)
              }
              const tb = parseRosterIds(
                lp.settings?.trade_block ?? lp.metadata?.trade_block,
              )
              if (tb.length > 0) {
                if (!perPlayerTB[lp.player_id]) perPlayerTB[lp.player_id] = []
                perPlayerTB[lp.player_id].push(...tb)
              }
            }
            interestAccum[league_id] = perPlayerLikes
            tbAccum[league_id] = perPlayerTB
          }
        }
        if (!cancelled) {
          setInterest(interestAccum)
          setTradeBlock(tbAccum)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [leagueKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { interestByLeague: interest, tradeBlockByLeague: tradeBlock, loading, error }
}
