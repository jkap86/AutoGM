'use client'

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

export function picksTillOtc(
  draft: DraftWithLeague,
  userId: string,
  league: LeagueDetailed | undefined,
): number {
  if (draft.status !== 'drafting') return -1
  const draftOrder = draft.draft_order ?? {}

  const totalRosters = draft.total_rosters
  const totalSlots = draft.settings.rounds * totalRosters
  const nextPickNo = draft.picks.length + 1
  if (nextPickNo > totalSlots) return -1

  const isSnake = draft.type === 'snake'

  const userRoster = league?.rosters.find((r) => r.user_id === userId)
  const ownedPicks = new Set<string>()

  if (userRoster && league) {
    const slotToRosterId = new Map<number, number>()
    for (const [uid, slot] of Object.entries(draftOrder)) {
      const r = league.rosters.find((ro) => ro.user_id === uid)
      if (r) slotToRosterId.set(slot, r.roster_id)
    }

    for (const dp of userRoster.draftpicks) {
      if (dp.season !== draft.season) continue
      for (const [slot, rid] of slotToRosterId) {
        if (rid === dp.roster_id && dp.round >= Math.ceil(nextPickNo / totalRosters)) {
          ownedPicks.add(`${dp.round}:${slot}`)
        }
      }
    }
  } else {
    const userSlot = draftOrder[userId]
    if (userSlot == null) return -1
    for (let r = 1; r <= draft.settings.rounds; r++) {
      ownedPicks.add(`${r}:${userSlot}`)
    }
  }

  if (ownedPicks.size === 0) return -1

  for (let i = 0; i < totalSlots - draft.picks.length; i++) {
    const pickNo = nextPickNo + i
    const round = Math.ceil(pickNo / totalRosters)
    const posInRound = ((pickNo - 1) % totalRosters) + 1
    const slot = isSnake && round % 2 === 0
      ? totalRosters - posInRound + 1
      : posInRound
    if (ownedPicks.has(`${round}:${slot}`)) return i
  }
  return -1
}

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

  /** Apply a single pick from a WebSocket player_picked event without refetching. */
  const applyPick = useCallback((payload: {
    draft_id: string
    pick_no: number
    player_id: string
    picked_by: string
    is_keeper: boolean | null
    metadata: { first_name: string; last_name: string; position: string; team: string; [k: string]: unknown }
  }) => {
    setDrafts((prev) => prev.map((draft) => {
      if (draft.draft_id !== payload.draft_id) return draft
      if (draft.picks.some((p) => p.pick_no === payload.pick_no)) return draft
      const round = Math.ceil(payload.pick_no / draft.total_rosters)
      const draft_slot = ((payload.pick_no - 1) % draft.total_rosters) + 1
      const newPick: DraftPick = {
        player_id: payload.player_id,
        picked_by: payload.picked_by,
        roster_id: 0,
        round,
        draft_slot,
        pick_no: payload.pick_no,
        is_keeper: payload.is_keeper,
        metadata: payload.metadata,
      }
      return { ...draft, picks: [...draft.picks, newPick] }
    }))
  }, [])

  return { drafts, loading, error, refetch: fetchDrafts, applyPick }
}
