'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  Transaction,
  LeagueTransactionsResult,
} from '../../main/graphql/queries/types'
import type { LeagueDetailed } from '../../main/lib/types'

export type TradeWithLeague = Transaction & {
  league_name: string;
}

type State = {
  trades: TradeWithLeague[]
  loading: boolean
  error: string | null
}

export function useTradesByStatus(
  leagues: { [league_id: string]: LeagueDetailed },
  status: string,
  limit?: number,
) {
  const [state, setState] = useState<State>({
    trades: [],
    loading: false,
    error: null,
  })

  const fetch = useCallback(async () => {
    const leagueEntries = Object.entries(leagues)
    if (leagueEntries.length === 0) return

    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const results = await Promise.all(
        leagueEntries.map(async ([league_id, league]) => {
          const result = await window.ipc.invoke<LeagueTransactionsResult>(
            'graphql',
            {
              name: 'leagueTransactions',
              vars: { league_id, status, type: 'trade', ...(limit != null ? { limit } : {}) },
            },
          )
          return result.league_transactions.map((tx) => ({
            ...tx,
            league_name: league.name,
          }))
        }),
      )

      const now = Date.now()
      const trades = results.flat()
        .filter((tx) => {
          if (status === 'proposed') {
            const expires = (tx.settings as Record<string, unknown>)?.expires_at
            if (typeof expires === 'number' && expires <= now) return false
          }
          if (status === 'complete') {
            const league = leagues[tx.league_id]
            if (league && !tx.roster_ids.includes(league.user_roster.roster_id)) return false
          }
          return true
        })
        .sort((a, b) => b.status_updated - a.status_updated)
      setState({ trades, loading: false, error: null })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      setState({ trades: [], loading: false, error })
    }
  }, [leagues, status, limit])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { ...state, refetch: fetch }
}
