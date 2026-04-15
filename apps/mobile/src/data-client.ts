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

export interface DataClient {
  graphql<N extends QueryName>(
    name: N,
    vars: QueryMap[N]['vars'],
  ): Promise<QueryMap[N]['result']>
  fetchLeagues(args: { user_id: string; season: string }): Promise<LeaguesPayload>
  fetchAllPlayers(): Promise<Allplayer[]>
}

export const mobileDataClient: DataClient = {
  graphql: (name, vars) => runQuery(name, vars),
  fetchLeagues: (args) => fetchLeaguesUncached(args),
  fetchAllPlayers: () => fetchAllPlayersUncached(),
}
