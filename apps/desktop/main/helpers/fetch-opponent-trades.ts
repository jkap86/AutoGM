import { getJson } from "./get-json"
import { runQuery } from "@autogm/shared"
import type { Transaction } from "@autogm/shared"
import createLogger from "../lib/logger"

const log = createLogger("fetch-opponent-trades")

type SleeperLeague = {
  league_id: string
  name: string
  season: string
}

/**
 * Fetches all completed trades involving specific players across ALL leagues
 * the opponent is in (not just leagues shared with the user).
 * Uses the public REST API to discover opponent's leagues, then GraphQL
 * to fetch trade history from each.
 */
type SleeperRoster = {
  roster_id: number
  owner_id: string | null
}

type SleeperUser = {
  user_id: string
  display_name: string
  username: string
}

export async function fetchOpponentTrades({
  opponentUserId,
  playerIds,
  season,
}: {
  opponentUserId: string
  playerIds: string[]
  season?: string
}): Promise<Array<Transaction & { league_name: string; roster_names: Record<number, string> }>> {
  if (playerIds.length === 0) return []

  const yr = season ?? new Date().getFullYear().toString()

  // 1. Get all leagues the opponent is in this season
  const leagues = await getJson<SleeperLeague[]>(
    `https://api.sleeper.app/v1/user/${opponentUserId}/leagues/nfl/${yr}`,
  )

  if (leagues.length === 0) return []

  const involved = new Set(playerIds)
  const results: Array<Transaction & { league_name: string; roster_names: Record<number, string> }> = []

  // 2. Fetch completed trades + roster/user mappings from each league (batched)
  const BATCH = 8
  for (let i = 0; i < leagues.length; i += BATCH) {
    const chunk = leagues.slice(i, i + BATCH)
    const responses = await Promise.all(
      chunk.map(async (lg) => {
        try {
          const [result, rosters, users] = await Promise.all([
            runQuery("leagueTransactions", {
              league_id: lg.league_id,
              type: "trade",
              status: "complete",
            }),
            getJson<SleeperRoster[]>(
              `https://api.sleeper.app/v1/league/${lg.league_id}/rosters`,
            ).catch(() => [] as SleeperRoster[]),
            getJson<SleeperUser[]>(
              `https://api.sleeper.app/v1/league/${lg.league_id}/users`,
            ).catch(() => [] as SleeperUser[]),
          ])

          // Build roster_id → display_name map
          const userMap = new Map(users.map((u) => [u.user_id, u.display_name || u.username]))
          const rosterNames: Record<number, string> = {}
          for (const r of rosters) {
            if (r.owner_id) {
              rosterNames[r.roster_id] = userMap.get(r.owner_id) ?? `Roster ${r.roster_id}`
            }
          }

          return { league: lg, txs: result.league_transactions, rosterNames }
        } catch (err) {
          log.warn(`failed to fetch trades for league ${lg.league_id}:`, err instanceof Error ? err.message : err)
          return { league: lg, txs: [] as Transaction[], rosterNames: {} as Record<number, string> }
        }
      }),
    )

    for (const { league: lg, txs, rosterNames } of responses) {
      for (const tx of txs) {
        const playerIdsInTrade = [
          ...Object.keys(tx.adds ?? {}),
          ...Object.keys(tx.drops ?? {}),
        ]
        if (playerIdsInTrade.some((pid) => involved.has(pid))) {
          results.push({ ...tx, league_name: lg.name, roster_names: rosterNames })
        }
      }
    }
  }

  results.sort((a, b) => b.status_updated - a.status_updated)
  return results
}
