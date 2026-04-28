'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Transaction,
  LeagueTransactionsResult,
  LeagueDetailed,
} from '@autogm/shared'
import { SleeperTopics } from '@autogm/shared'
import { useGatewayTopic } from '../contexts/socket-context'

export type TradeWithLeague = Transaction & {
  league_name: string;
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

// Events to ignore (high-frequency or not trade-related)
const IGNORE_EVENTS = new Set([
  'phx_reply',
  'phx_join',
  'presence_diff',
  'presence_state',
  'typing',
  'read_receipt',
  'heartbeat',
  'message_created',
  'notifications',
  'mention',
  'draft_updated_by_pick',
  'player_picked',
])

export function useTradesByStatus(
  leagues: { [league_id: string]: LeagueDetailed },
  status: string,
  limit?: number,
  userId?: string,
) {
  const [state, setState] = useState<State>({
    trades: [],
    loading: false,
    error: null,
  })

  const fetchFn = useCallback(async () => {
    const leagueEntries = Object.entries(leagues)
    if (leagueEntries.length === 0) return

    setState((s) => ({ ...s, loading: s.trades.length === 0, error: null }))
    try {
      const results = await mapWithConcurrency(
        leagueEntries,
        MAX_CONCURRENT,
        async ([league_id, league]) => {
          const result = await fetchWithRetry(() =>
            window.ipc.invoke<LeagueTransactionsResult>(
              'graphql',
              {
                name: 'leagueTransactions',
                vars: { league_id, status: status === 'expired' ? 'proposed' : status, type: 'trade', ...(limit != null ? { limit } : {}) },
              },
            ),
          )
          return result.league_transactions.map((tx) => ({
            ...tx,
            league_name: league.name,
          }))
        },
      )

      const nowMs = Date.now()
      const trades = results.flat()
        .filter((tx) => {
          const rawExpires = (tx.settings as Record<string, unknown>)?.expires_at
          // Sleeper stores expires_at in seconds; convert to ms for comparison
          const expiresMs = typeof rawExpires === 'number'
            ? (rawExpires < 10_000_000_000 ? rawExpires * 1000 : rawExpires)
            : null
          const isExpired = expiresMs !== null && expiresMs <= nowMs

          if (status === 'proposed') {
            if (isExpired) return false
          }
          if (status === 'expired') {
            if (!isExpired) return false
          }
          if (status === 'complete') {
            const league = leagues[tx.league_id]
            if (league && !tx.roster_ids.includes(league.user_roster.roster_id)) return false
          }
          if (status === 'rejected') {
            if (isExpired) return false
          }
          return true
        })
        .sort((a, b) => b.status_updated - a.status_updated)
      setState({ trades, loading: false, error: null })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      setState((s) => ({ ...s, loading: false, error }))
    }
  }, [leagues, status, limit])

  // Initial fetch
  useEffect(() => {
    fetchFn()
  }, [fetchFn])

  // Refetch on trade-related WebSocket events from user channel (debounced)
  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useGatewayTopic(
    userId ? SleeperTopics.user(userId) : null,
    useCallback((event: string) => {
      if (!IGNORE_EVENTS.has(event)) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => fetchRef.current(), 2000)
      }
    }, []),
  )

  return { ...state, refetch: fetchFn }
}
