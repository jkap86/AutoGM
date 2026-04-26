// Types
export * from './types'
export * from './graphql/queries/types'

// Auth
export { setSession, getSession, getToken, clearSession } from './auth/session'
export type { Session as InternalSession } from './auth/session'

// GraphQL
export { gqlRequest, configureClient, GraphQLRequestError } from './graphql/client'
export type { GraphQLError, GqlRequestOptions } from './graphql/client'
export { runQuery } from './graphql/queries'

// API helpers
export { getJson } from './api/get-json'
export { getLeagueDetails, getLeagueDraftPicksObj, getRostersUserInfo } from './api/get-league-details'
export type { LeagueWithRosters } from './api/get-league-details'
export { fetchLeaguesUncached } from './api/fetch-leagues'
export { fetchAllPlayersUncached } from './api/fetch-allplayers'

// Constants
export { BROWSER_HEADERS } from './browser-headers'
export { CURRENT_SEASON } from './config'

// Lib
export { randomId } from './lib/random-id'
export { getPickId, deriveCollections } from './lib/leagues'
export { buildPlayerAttachment, buildUserAttachment } from './lib/trade-helpers'

// DB queries (require pg Pool)
export { fetchKtcLatest, fetchKtcByDate, fetchKtcHistory } from './db/ktc'
export type { KtcData, KtcHistory, KtcHistoryRow } from './db/ktc'
export { fetchAdp, fetchAdpStats } from './db/adp'
export type { AdpFilters, AdpRow } from './db/adp'
export { fetchOpponentDrafts } from './db/opponent-drafts'
export type { OpponentDraftPick } from './db/opponent-drafts'

// React hooks are in "@autogm/shared/react" to avoid pulling React
// into non-React environments (e.g. Electron main process).
