import { useState, useEffect, useCallback, useRef } from 'react'
import type { Draft, LeagueDetailed } from '@autogm/shared'
import { getJson, mapWithConcurrency } from '@autogm/shared'

export type DraftPick = {
  player_id: string
  picked_by: string
  roster_id: number
  round: number
  draft_slot: number
  pick_no: number
  is_keeper: boolean | null
  metadata: {
    first_name: string
    last_name: string
    position: string
    team: string
    [key: string]: unknown
  }
}

export type DraftWithLeague = Draft & {
  league_id: string
  league_name: string
  league_avatar: string | null
  total_rosters: number
  picks: DraftPick[]
}

const MAX_CONCURRENT = 4

export function useDrafts(leagues: { [id: string]: LeagueDetailed } | null) {
  const [drafts, setDrafts] = useState<DraftWithLeague[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cache completed draft picks — they never change
  const completedPicksCache = useRef(new Map<string, DraftPick[]>())

  const fetchDrafts = useCallback(async () => {
    if (!leagues || Object.keys(leagues).length === 0) return
    setLoading(true)
    setError(null)

    try {
      const leagueEntries = Object.entries(leagues)

      const nestedResults = await mapWithConcurrency(
        leagueEntries,
        MAX_CONCURRENT,
        async ([league_id, league]): Promise<DraftWithLeague[]> => {
          try {
            const leagueDrafts = await getJson<Draft[]>(
              `https://api.sleeper.app/v1/league/${league_id}/drafts`,
            )

            const draftsWithPicks = await mapWithConcurrency(
              leagueDrafts,
              2,
              async (draft): Promise<DraftWithLeague> => {
                let picks: DraftPick[] = []
                if (draft.status === 'complete') {
                  const cached = completedPicksCache.current.get(draft.draft_id)
                  if (cached) {
                    picks = cached
                  } else {
                    try {
                      picks = await getJson<DraftPick[]>(
                        `https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`,
                      )
                      completedPicksCache.current.set(draft.draft_id, picks)
                    } catch {
                      // picks fetch failed, show draft without picks
                    }
                  }
                } else if (draft.status === 'drafting') {
                  try {
                    picks = await getJson<DraftPick[]>(
                      `https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`,
                    )
                  } catch {
                    // picks fetch failed, show draft without picks
                  }
                }

                return {
                  ...draft,
                  league_id,
                  league_name: league.name,
                  league_avatar: league.avatar,
                  total_rosters: league.total_rosters,
                  picks,
                }
              },
            )

            return draftsWithPicks
          } catch {
            return []
          }
        },
      )

      const allDrafts = nestedResults.flat()

      // Sort: drafting first, then pre_draft, then complete
      const statusOrder: Record<string, number> = { drafting: 0, pre_draft: 1, complete: 2 }
      allDrafts.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3))

      setDrafts(allDrafts)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [leagues])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  return { drafts, loading, error, refetch: fetchDrafts }
}
