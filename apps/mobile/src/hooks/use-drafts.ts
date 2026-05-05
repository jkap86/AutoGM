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

export type DraftTradedPick = {
  roster_id: number
  owner_id: number
  previous_owner_id: number
  round: number
}

export type DraftWithLeague = Draft & {
  league_id: string
  league_name: string
  league_avatar: string | null
  total_rosters: number
  picks: DraftPick[]
  tradedPicks: DraftTradedPick[]
}

const MAX_CONCURRENT = 4

/**
 * Compute how many picks until a user is on the clock.
 * Returns 0 if OTC now, -1 if draft is not active or user has no slot.
 * Handles snake/linear ordering, traded picks, and compensatory rounds.
 */
export function picksTillOtc(
  draft: DraftWithLeague,
  userId: string,
  league: LeagueDetailed | undefined,
): number {
  if (draft.status !== 'drafting') return -1
  const draftOrder = draft.draft_order ?? {}

  const totalRosters = draft.total_rosters
  const isSnake = draft.type === 'snake'
  // Regular rounds from league settings; rounds beyond are compensatory
  const regularRounds = league?.settings.draft_rounds ?? draft.settings.rounds

  // Track which positions have already been picked
  const pickedPositions = new Set<string>()
  for (const p of draft.picks) pickedPositions.add(`${p.round}:${p.draft_slot}`)

  // Build ordered list of remaining positions (regular rounds only)
  // Comp rounds are unpredictable — we skip them entirely
  const remaining: { round: number; slot: number }[] = []

  for (let round = 1; round <= regularRounds; round++) {
    for (let pos = 1; pos <= totalRosters; pos++) {
      const slot = isSnake && round % 2 === 0
        ? totalRosters - pos + 1
        : pos
      if (!pickedPositions.has(`${round}:${slot}`)) {
        remaining.push({ round, slot })
      }
    }
  }

  if (remaining.length === 0) return -1

  // Build set of (round, slot) pairs the user actually owns
  const ownedPicks = new Set<string>()
  const userSlot = draftOrder[userId]
  if (userSlot == null) return -1

  // Map slot -> roster_id for traded pick lookups
  const slotToRosterId = new Map<number, number>()
  const rosterIdToSlot = new Map<number, number>()
  if (league) {
    for (const [uid, slot] of Object.entries(draftOrder)) {
      const r = league.rosters.find((ro) => ro.user_id === uid)
      if (r) {
        slotToRosterId.set(slot, r.roster_id)
        rosterIdToSlot.set(r.roster_id, slot)
      }
    }
  }

  const userRosterId = slotToRosterId.get(userSlot)

  // Start with user's original slot for all regular rounds
  for (let r = 1; r <= regularRounds; r++) {
    ownedPicks.add(`${r}:${userSlot}`)
  }

  // Apply draft-level traded picks to adjust ownership
  if (draft.tradedPicks?.length > 0 && userRosterId != null) {
    for (const tp of draft.tradedPicks) {
      const slot = rosterIdToSlot.get(tp.roster_id)
      if (slot == null) continue
      const key = `${tp.round}:${slot}`
      if (tp.owner_id === userRosterId && tp.previous_owner_id !== userRosterId) {
        // User acquired this pick
        ownedPicks.add(key)
      } else if (tp.previous_owner_id === userRosterId && tp.owner_id !== userRosterId) {
        // User traded this pick away
        ownedPicks.delete(key)
      }
    }
  } else if (league) {
    // Fall back to league roster draftpick data (dynasty leagues)
    const userRoster = league.rosters.find((r) => r.user_id === userId)
    if (userRoster && userRoster.draftpicks.length > 0) {
      ownedPicks.clear()
      for (const dp of userRoster.draftpicks) {
        if (dp.season !== draft.season) continue
        for (const [slot, rid] of slotToRosterId) {
          if (rid === dp.roster_id) {
            ownedPicks.add(`${dp.round}:${slot}`)
          }
        }
      }
    }
  }

  if (ownedPicks.size === 0) return -1

  for (let i = 0; i < remaining.length; i++) {
    const { round, slot } = remaining[i]
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
                let tradedPicks: DraftTradedPick[] = []
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
                    const [p, tp] = await Promise.all([
                      getJson<DraftPick[]>(
                        `https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`,
                      ),
                      getJson<DraftTradedPick[]>(
                        `https://api.sleeper.app/v1/draft/${draft.draft_id}/traded_picks`,
                      ),
                    ])
                    picks = p
                    tradedPicks = tp
                  } catch {
                    // fetch failed, show draft without picks
                  }
                }

                return {
                  ...draft,
                  league_id,
                  league_name: league.name,
                  league_avatar: league.avatar,
                  total_rosters: league.total_rosters,
                  picks,
                  tradedPicks,
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
      // Avoid duplicate if already applied
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
