import { getJson } from "./get-json"
import { runQuery } from "@sleepier/shared"
import type { Transaction } from "@sleepier/shared"

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
export async function fetchOpponentTrades({
  opponentUserId,
  playerIds,
  season,
}: {
  opponentUserId: string
  playerIds: string[]
  season?: string
}): Promise<Array<Transaction & { league_name: string }>> {
  if (playerIds.length === 0) return []

  const yr = season ?? new Date().getFullYear().toString()

  // 1. Get all leagues the opponent is in this season
  const leagues = await getJson<SleeperLeague[]>(
    `https://api.sleeper.app/v1/user/${opponentUserId}/leagues/nfl/${yr}`,
  )

  if (leagues.length === 0) return []

  const involved = new Set(playerIds)
  const results: Array<Transaction & { league_name: string }> = []

  // 2. Fetch completed trades from each league via GraphQL (batched)
  const BATCH = 8
  for (let i = 0; i < leagues.length; i += BATCH) {
    const chunk = leagues.slice(i, i + BATCH)
    const responses = await Promise.all(
      chunk.map(async (lg) => {
        try {
          const result = await runQuery("leagueTransactions", {
            league_id: lg.league_id,
            type: "trade",
            status: "complete",
          })
          return { league: lg, txs: result.league_transactions }
        } catch {
          return { league: lg, txs: [] as Transaction[] }
        }
      }),
    )

    for (const { league: lg, txs } of responses) {
      for (const tx of txs) {
        const playerIdsInTrade = [
          ...Object.keys(tx.adds ?? {}),
          ...Object.keys(tx.drops ?? {}),
        ]
        if (playerIdsInTrade.some((pid) => involved.has(pid))) {
          results.push({ ...tx, league_name: lg.name })
        }
      }
    }
  }

  results.sort((a, b) => b.status_updated - a.status_updated)
  return results
}
