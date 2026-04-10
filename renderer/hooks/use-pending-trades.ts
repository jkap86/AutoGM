'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  Transaction,
  LeagueTransactionsResult,
} from '../../main/graphql/queries/types'
import type { LeagueDetailed } from '../../main/lib/types'

export type PendingTrade = Transaction & {
  league_name: string;
}

type State = {
  trades: PendingTrade[]
  loading: boolean
  error: string | null
}

export function usePendingTrades(leagues: { [league_id: string]: LeagueDetailed }) {
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
              vars: { league_id, status: 'proposed', type: 'trade' },
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
          const expires = (tx.settings as Record<string, unknown>)?.expires_at
          return typeof expires !== 'number' || expires > now
        })
        .sort((a, b) => b.created - a.created)
      setState({ trades, loading: false, error: null })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      setState({ trades: [], loading: false, error })
    }
  }, [leagues])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { ...state, refetch: fetch }
}
