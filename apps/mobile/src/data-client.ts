import {
  runQuery,
  configureClient,
  getToken,
  getSession,
  fetchLeaguesUncached,
  fetchAllPlayersUncached,
} from '@autogm/shared'
import type { QueryMap, QueryName, LeaguesPayload, Allplayer, KtcData, AdpFilters, AdpRow } from '@autogm/shared'

// Wire up the shared GraphQL client to use the shared session token
configureClient({ getToken })

const REQUEST_TIMEOUT_MS = 15_000

function withTimeout<T>(promise: Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://autogm-8d8d424e3286.herokuapp.com'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const session = getSession()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': session?.user_id || '',
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}

export interface DataClient {
  graphql<N extends QueryName>(
    name: N,
    vars: QueryMap[N]['vars'],
  ): Promise<QueryMap[N]['result']>
  fetchLeagues(args: { user_id: string; season: string }): Promise<LeaguesPayload>
  fetchAllPlayers(): Promise<Allplayer[]>
  fetchKtcLatest(): Promise<KtcData>
  fetchKtcByDate(date: string): Promise<KtcData>
  fetchAdp(filters: AdpFilters): Promise<AdpRow[]>
  fetchAdpStats(filters: AdpFilters): Promise<{ n_drafts: number; n_leagues: number }>
}

export const mobileDataClient: DataClient = {
  graphql: (name, vars) => withTimeout(runQuery(name, vars)),
  fetchLeagues: (args) => withTimeout(fetchLeaguesUncached(args), 30_000),
  fetchAllPlayers: () => withTimeout(fetchAllPlayersUncached(), 30_000),
  fetchKtcLatest: () => withTimeout(apiFetch<KtcData>('/api/ktc/latest')),
  fetchKtcByDate: (date) => withTimeout(apiFetch<KtcData>(`/api/ktc/by-date?date=${date}`)),
  fetchAdp: (filters) => withTimeout(apiFetch<AdpRow[]>('/api/adp/fetch', {
    method: 'POST',
    body: JSON.stringify(filters),
  })),
  fetchAdpStats: (filters) => withTimeout(apiFetch<{ n_drafts: number; n_leagues: number }>('/api/adp/stats', {
    method: 'POST',
    body: JSON.stringify(filters),
  })),
}
