'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { Allplayer, LeagueDetailed, Roster, PlayerPickedPayload } from '@autogm/shared'
import { SleeperTopics } from '@autogm/shared'
import { useDrafts, picksTillOtc, type DraftWithLeague, type DraftPick } from '../../hooks/use-drafts'
import { useGatewayTopic, useSocketContext } from '../../contexts/socket-context'
import { PlayerCombobox } from '../components/player-combobox'

const STATUS_LABELS: Record<string, string> = {
  drafting: 'Live',
  pre_draft: 'Upcoming',
  complete: 'Completed',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  drafting: { bg: 'bg-green-500/20', text: 'text-green-400' },
  pre_draft: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  complete: { bg: 'bg-gray-600/20', text: 'text-gray-400' },
}

const POS_BG: Record<string, string> = {
  QB: 'bg-red-500/15 border-red-500/30',
  RB: 'bg-green-500/15 border-green-500/30',
  WR: 'bg-blue-500/15 border-blue-500/30',
  TE: 'bg-orange-500/15 border-orange-500/30',
  K: 'bg-purple-500/15 border-purple-500/30',
  DEF: 'bg-yellow-500/15 border-yellow-500/30',
}

const POS_TEXT: Record<string, string> = {
  QB: 'text-red-300',
  RB: 'text-green-300',
  WR: 'text-blue-300',
  TE: 'text-orange-300',
  K: 'text-purple-300',
  DEF: 'text-yellow-300',
}

type SlotOwner = { username: string; userId: string }

function buildSlotOwners(
  draft: DraftWithLeague,
  league: LeagueDetailed | undefined,
): SlotOwner[] {
  const owners: SlotOwner[] = Array.from({ length: draft.total_rosters }, (_, i) => ({
    username: `Slot ${i + 1}`,
    userId: '',
  }))
  if (!draft.draft_order || !league) return owners
  for (const [userId, slot] of Object.entries(draft.draft_order)) {
    if (slot >= 1 && slot <= draft.total_rosters) {
      const roster = league.rosters.find((r: Roster) => r.user_id === userId)
      owners[slot - 1] = { username: roster?.username ?? userId.slice(0, 6), userId }
    }
  }
  return owners
}

function getCurrentRound(draft: DraftWithLeague): number {
  if (draft.picks.length === 0) return 1
  return draft.picks[draft.picks.length - 1].round
}

function getPicksByRound(picks: DraftPick[]): Record<number, DraftPick[]> {
  const byRound: Record<number, DraftPick[]> = {}
  for (const pick of picks) {
    if (!byRound[pick.round]) byRound[pick.round] = []
    byRound[pick.round].push(pick)
  }
  return byRound
}

function PickCell({
  pick,
  allplayers,
  originalOwnerId,
  pickerName,
  originalOwnerName,
}: {
  pick: DraftPick
  allplayers: Record<string, Allplayer>
  originalOwnerId: string
  pickerName: string
  originalOwnerName: string
}) {
  const player = allplayers[pick.player_id]
  const lastName = player?.last_name
    ?? pick.metadata?.last_name
    ?? pick.player_id.slice(0, 6)
  const pos = player?.position ?? pick.metadata?.position ?? '?'
  const team = player?.team ?? pick.metadata?.team ?? ''
  const posBg = POS_BG[pos] ?? 'bg-gray-700/30 border-gray-600/30'
  const posText = POS_TEXT[pos] ?? 'text-gray-300'
  const slot = String(pick.draft_slot).padStart(2, '0')
  const isTraded = originalOwnerId !== '' && pick.picked_by !== '' && pick.picked_by !== originalOwnerId

  return (
    <div className={`border rounded px-1.5 py-1 min-w-[72px] ${posBg} ${isTraded ? 'border-amber-500/30' : ''}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-gray-500 text-[9px] font-mono">{pick.round}.{slot}</span>
        <span className={`text-[9px] font-bold ${posText}`}>{pos}</span>
      </div>
      <div className={`text-[11px] font-medium truncate ${posText}`}>{lastName}</div>
      {isTraded ? (
        <div>
          <div className="text-amber-400 text-[8px] font-bold truncate">{pickerName}</div>
          <div className="text-gray-600 text-[7px] truncate">via {originalOwnerName}</div>
        </div>
      ) : (
        team && <div className="text-gray-500 text-[9px]">{team}</div>
      )}
    </div>
  )
}

function EmptyCell({ round, slot, tradedTo }: { round: number; slot: number; tradedTo?: string }) {
  return (
    <div className={`border rounded px-1.5 py-1 min-w-[72px] bg-gray-800/50 ${tradedTo ? 'border-amber-500/20 border-dashed' : 'border-gray-700/40 border-dashed'}`}>
      <div className="text-gray-600 text-[9px] font-mono">{round}.{String(slot).padStart(2, '0')}</div>
      {tradedTo ? (
        <div className="text-amber-400/70 text-[9px] font-medium truncate">{tradedTo}</div>
      ) : (
        <div className="text-gray-700 text-[11px]">—</div>
      )}
    </div>
  )
}

function HeaderRow({ slotOwners }: { slotOwners: SlotOwner[] }) {
  return (
    <div className="flex gap-1 items-stretch">
      <div className="w-8 shrink-0" />
      {slotOwners.map((owner, i) => (
        <div key={i} className="flex items-center justify-center rounded bg-gray-700/60 py-1 min-w-[72px]">
          <span className="text-gray-300 text-[9px] font-bold truncate px-1">{owner.username}</span>
        </div>
      ))}
    </div>
  )
}

function RoundRow({
  round,
  picks,
  allplayers,
  totalRosters,
  isCurrentRound,
  slotOwners,
  userIdToName,
  tradedSlots,
}: {
  round: number
  picks: DraftPick[]
  allplayers: Record<string, Allplayer>
  totalRosters: number
  isCurrentRound: boolean
  slotOwners: SlotOwner[]
  userIdToName: Record<string, string>
  tradedSlots: Record<number, string>
}) {
  const pickBySlot = new Map<number, DraftPick>()
  for (const pick of picks) pickBySlot.set(pick.draft_slot, pick)

  return (
    <div className="flex gap-1 items-stretch">
      <div className={`flex items-center justify-center w-8 shrink-0 rounded text-[10px] font-bold ${
        isCurrentRound ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700/40 text-gray-500'
      }`}>
        R{round}
      </div>
      {Array.from({ length: totalRosters }, (_, i) => {
        const slot = i + 1
        const pick = pickBySlot.get(slot)
        return pick
          ? <PickCell
              key={slot}
              pick={pick}
              allplayers={allplayers}
              originalOwnerId={slotOwners[slot - 1]?.userId ?? ''}
              pickerName={userIdToName[pick.picked_by] ?? ''}
              originalOwnerName={slotOwners[slot - 1]?.username ?? ''}
            />
          : <EmptyCell key={slot} round={round} slot={slot} tradedTo={tradedSlots[slot]} />
      })}
    </div>
  )
}

function DraftCard({
  draft,
  allplayers,
  leagues,
  userId,
  otcCount,
}: {
  draft: DraftWithLeague
  allplayers: Record<string, Allplayer>
  leagues: { [id: string]: LeagueDetailed }
  userId: string
  otcCount: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [prevStatus, setPrevStatus] = useState(draft.status)
  if (draft.status !== prevStatus) {
    setPrevStatus(draft.status)
    if (draft.status === 'drafting') setExpanded(true)
  }
  const [picking, setPicking] = useState(false)

  const isOtc = otcCount === 0

  const currentRound = getCurrentRound(draft)
  const { picksByRound, rounds } = useMemo(() => {
    const byRound = getPicksByRound(draft.picks)
    return {
      picksByRound: byRound,
      rounds: Object.keys(byRound).map(Number).sort((a, b) => a - b),
    }
  }, [draft.picks])
  const totalPicks = draft.picks.length
  const totalSlots = draft.settings.rounds * draft.total_rosters
  const statusStyle = STATUS_COLORS[draft.status] ?? STATUS_COLORS.complete

  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null
  const league = leagues[draft.league_id]
  const slotOwners = useMemo(() => buildSlotOwners(draft, league), [draft, league])

  const userIdToName = useMemo(() => {
    const map: Record<string, string> = {}
    if (league) {
      for (const r of league.rosters) map[r.user_id] = r.username
    }
    return map
  }, [league])

  const tradedSlotsMap = useMemo(() => {
    const map: Record<number, string> = {}
    if (!draft.draft_order) return map
    for (const pick of draft.picks) {
      const origOwner = slotOwners[pick.draft_slot - 1]
      if (origOwner && pick.picked_by !== origOwner.userId) {
        map[pick.draft_slot] = userIdToName[pick.picked_by] ?? ''
      }
    }
    return map
  }, [draft.picks, draft.draft_order, slotOwners, userIdToName])

  const draftedIds = useMemo(() => new Set(draft.picks.map((p) => p.player_id)), [draft.picks])
  const availablePlayerIds = useMemo(
    () => Object.keys(allplayers).filter((id) => !draftedIds.has(id) && allplayers[id]?.active),
    [allplayers, draftedIds],
  )

  const handlePick = useCallback(async (playerId: string) => {
    setPicking(true)
    try {
      await window.ipc.invoke('graphql', {
        name: 'makeDraftPick',
        vars: { draft_id: draft.draft_id, player_id: playerId },
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setPicking(false)
    }
  }, [draft.draft_id])

  return (
    <div className={`rounded-xl border p-4 ${isOtc ? 'bg-green-900/20 border-green-500/50' : 'bg-gray-800 border-gray-700/80'}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-white font-semibold text-sm truncate flex-1">
            {draft.league_name}
          </span>
          <div className="flex items-center gap-2 ml-2">
            {isOtc && (
              <span className="bg-green-500/30 text-green-300 px-2 py-0.5 rounded text-[11px] font-bold">OTC</span>
            )}
            {otcCount > 0 && (
              <span className="text-yellow-400 text-[11px] font-medium">{otcCount} away</span>
            )}
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
              {STATUS_LABELS[draft.status] ?? draft.status}
            </span>
            <span className="text-gray-500 text-[11px]">{draft.season}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">
            {draft.settings.rounds} rounds · {draft.total_rosters} teams
          </span>
          {draft.status === 'drafting' && (
            <span className="text-green-400 text-xs font-medium">
              Round {currentRound} · {totalPicks}/{totalSlots} picks
            </span>
          )}
          {draft.status === 'complete' && (
            <span className="text-gray-500 text-xs">{totalPicks} picks</span>
          )}
          {draft.status === 'pre_draft' && (
            <span className="text-yellow-400/70 text-xs">Not started</span>
          )}
        </div>
      </button>

      {/* Pick UI — shown when OTC */}
      {isOtc && (
        <div className="mt-2 mb-1">
          <PlayerCombobox
            id={`draft-pick-${draft.draft_id}`}
            playerIds={availablePlayerIds}
            allplayers={allplayers}
            selected={[]}
            onSelect={handlePick}
            placeholder={picking ? 'Submitting pick...' : 'Search to pick...'}
          />
        </div>
      )}

      {/* Draft grid */}
      {draft.picks.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <div className="flex flex-col gap-1 min-w-fit">
            <HeaderRow slotOwners={slotOwners} />
            {expanded ? (
              rounds.map((round) => (
                <RoundRow
                  key={round}
                  round={round}
                  picks={picksByRound[round]}
                  allplayers={allplayers}
                  totalRosters={draft.total_rosters}
                  isCurrentRound={draft.status === 'drafting' && round === currentRound}
                  slotOwners={slotOwners}
                  userIdToName={userIdToName}
                  tradedSlots={tradedSlotsMap}
                />
              ))
            ) : (
              lastRound != null && (
                <RoundRow
                  round={lastRound}
                  picks={picksByRound[lastRound]}
                  allplayers={allplayers}
                  totalRosters={draft.total_rosters}
                  isCurrentRound={draft.status === 'drafting' && lastRound === currentRound}
                  slotOwners={slotOwners}
                  userIdToName={userIdToName}
                  tradedSlots={tradedSlotsMap}
                />
              )
            )}
          </div>

          {/* Expand/collapse toggle */}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="w-full text-center pt-2"
          >
            <span className="text-blue-400 text-xs font-medium">
              {expanded ? 'Collapse' : `Show all ${rounds.length} rounds`}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

type FilterTab = 'all' | 'drafting' | 'pre_draft' | 'complete'

export default function DraftsView({
  leagues,
  allplayers,
  userId,
}: {
  leagues: { [id: string]: LeagueDetailed }
  allplayers: { [id: string]: Allplayer }
  userId: string
}) {
  const { drafts, loading, refetch, applyPick } = useDrafts(leagues)
  const [filter, setFilter] = useState<FilterTab>('all')
  const { gateway } = useSocketContext()

  // Debounced refetch for structural changes (new drafts, status changes)
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => { refetch() }, 2000)
  }, [refetch])

  useGatewayTopic(
    userId ? SleeperTopics.user(userId) : null,
    useCallback(
      (event: string) => {
        if (event === 'draft_created' || event === 'draft_traded_pick') {
          debouncedRefetch()
        }
      },
      [debouncedRefetch],
    ),
  )

  // Subscribe to all live draft topics — apply picks instantly
  const applyPickRef = useRef(applyPick)
  applyPickRef.current = applyPick

  useEffect(() => {
    if (!gateway) return
    const liveDrafts = drafts.filter((d) => d.status === 'drafting')
    if (liveDrafts.length === 0) return

    const unsubs = liveDrafts.map((d) =>
      gateway.join(SleeperTopics.draft(d.draft_id), (event: string, payload: unknown) => {
        if (event === 'player_picked' && payload) {
          applyPickRef.current(payload as PlayerPickedPayload)
        }
      }),
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [gateway, drafts])

  const sortedDrafts = useMemo(() => {
    return [...drafts].sort((a, b) => {
      const aOtc = picksTillOtc(a, userId, leagues[a.league_id])
      const bOtc = picksTillOtc(b, userId, leagues[b.league_id])
      if (aOtc >= 0 && bOtc >= 0) return aOtc - bOtc
      if (aOtc >= 0) return -1
      if (bOtc >= 0) return 1
      const statusOrder: Record<string, number> = { drafting: 0, pre_draft: 1, complete: 2 }
      return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    })
  }, [drafts, userId])

  const filteredDrafts = useMemo(() => {
    if (filter === 'all') return sortedDrafts
    return sortedDrafts.filter((d) => d.status === filter)
  }, [sortedDrafts, filter])

  const counts = useMemo(() => {
    const c = { all: drafts.length, drafting: 0, pre_draft: 0, complete: 0 }
    for (const d of drafts) {
      if (d.status in c) c[d.status as keyof typeof c]++
    }
    return c
  }, [drafts])

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'drafting', label: 'Live', count: counts.drafting },
    { key: 'pre_draft', label: 'Upcoming', count: counts.pre_draft },
    { key: 'complete', label: 'Completed', count: counts.complete },
  ]

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-4">
      <div className="flex gap-1 rounded-lg bg-gray-900/60 p-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`rounded-md px-5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
              filter === t.key
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}{t.count > 0 ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {loading && drafts.length === 0 ? (
        <p className="text-gray-400 text-sm mt-10">Loading drafts…</p>
      ) : filteredDrafts.length === 0 ? (
        <p className="text-gray-500 text-sm mt-10">
          No {filter === 'all' ? '' : STATUS_LABELS[filter]?.toLowerCase() + ' '}drafts found
        </p>
      ) : (
        <div className="w-full flex flex-col gap-3">
          {filteredDrafts.map((draft) => (
            <DraftCard
              key={draft.draft_id}
              draft={draft}
              allplayers={allplayers}
              leagues={leagues}
              userId={userId}
              otcCount={picksTillOtc(draft, userId, leagues[draft.league_id])}
            />
          ))}
        </div>
      )}
    </div>
  )
}
