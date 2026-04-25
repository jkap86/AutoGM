import {
  runQuery,
  configureClient,
  getToken,
  fetchLeaguesUncached,
  fetchAllPlayersUncached,
} from '@sleepier/shared'
import type { QueryMap, QueryName, LeaguesPayload, Allplayer } from '@sleepier/shared'

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

export interface DataClient {
  graphql<N extends QueryName>(
    name: N,
    vars: QueryMap[N]['vars'],
  ): Promise<QueryMap[N]['result']>
  fetchLeagues(args: { user_id: string; season: string }): Promise<LeaguesPayload>
  fetchAllPlayers(): Promise<Allplayer[]>
}

export const mobileDataClient: DataClient = {
  graphql: (name, vars) => withTimeout(runQuery(name, vars)),
  fetchLeagues: (args) => withTimeout(fetchLeaguesUncached(args), 30_000),
  fetchAllPlayers: () => withTimeout(fetchAllPlayersUncached(), 30_000),
}
