import { useCallback, useEffect, useState } from 'react'
import type { Transaction, LeagueTransactionsResult, LeagueDetailed } from '@sleepier/shared'
import { mobileDataClient } from '../data-client'

export type TradeWithLeague = Transaction & {
  league_name: string
}

type State = {
  trades: TradeWithLeague[]
  loading: boolean
  error: string | null
}

const MAX_CONCURRENT = 4

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = next++
        if (i >= items.length) return
        results[i] = await fn(items[i])
      }
    },
  )
  await Promise.all(workers)
  return results
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 1000,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (attempt >= retries) throw e
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
    }
  }
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

  const fetchTrades = useCallback(async () => {
    const leagueEntries = Object.entries(leagues)
    if (leagueEntries.length === 0) return

    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const results = await mapWithConcurrency(
        leagueEntries,
        MAX_CONCURRENT,
        async ([league_id, league]) => {
          const result = await fetchWithRetry(() =>
            mobileDataClient.graphql('leagueTransactions', {
              league_id,
              status,
              type: 'trade',
              ...(limit != null ? { limit } : {}),
            }),
          ) as LeagueTransactionsResult
          return result.league_transactions.map((tx) => ({
            ...tx,
            league_name: league.name,
          }))
        },
      )

      const now = Date.now()
      const trades = results
        .flat()
        .filter((tx) => {
          if (status === 'proposed') {
            const expires = (tx.settings as Record<string, unknown>)?.expires_at
            if (typeof expires === 'number' && expires <= now) return false
          }
          if (status === 'complete') {
            const league = leagues[tx.league_id]
            if (league && !tx.roster_ids.includes(league.user_roster.roster_id))
              return false
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
    fetchTrades()
  }, [fetchTrades])

  return { ...state, refetch: fetchTrades }
}
