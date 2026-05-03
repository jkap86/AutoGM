import { useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native'
import { useAuth } from '@autogm/shared/react'
import type { Allplayer, LeagueDetailed, Roster, PlayerPickedPayload } from '@autogm/shared'
import { SleeperTopics } from '@autogm/shared'
import { useLeagueCache } from '../../../src/league-cache'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { useDrafts, picksTillOtc, type DraftWithLeague, type DraftPick } from '../../../src/hooks/use-drafts'
import { mobileDataClient } from '../../../src/data-client'
import { PlayerCombobox } from '../../../src/components/player-combobox'
import { ErrorBoundary } from '../../../src/components/error-boundary'
import { useGatewayTopic, useGatewayTopics } from '../../../src/contexts/socket-context'

const STATUS_LABELS: Record<string, string> = {
  drafting: 'Live',
  pre_draft: 'Upcoming',
  complete: 'Completed',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  drafting: { bg: 'bg-green-500/20', text: 'text-green-400' },
  pre_draft: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  complete: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
}

const POS_BG: Record<string, string> = {
  QB: 'bg-red-500/15',
  RB: 'bg-green-500/15',
  WR: 'bg-blue-500/15',
  TE: 'bg-orange-500/15',
  K: 'bg-purple-500/15',
  DEF: 'bg-yellow-500/15',
}

const POS_BORDER: Record<string, string> = {
  QB: '#EF444430',
  RB: '#22C55E30',
  WR: '#3B82F630',
  TE: '#F9731630',
  K: '#A855F730',
  DEF: '#EAB30830',
}

const POS_TEXT: Record<string, string> = {
  QB: 'text-red-300',
  RB: 'text-green-300',
  WR: 'text-blue-300',
  TE: 'text-orange-300',
  K: 'text-purple-300',
  DEF: 'text-yellow-300',
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

const CELL_WIDTH = 68

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
  // draft_order: { user_id: slot_number }
  for (const [userId, slot] of Object.entries(draft.draft_order)) {
    if (slot >= 1 && slot <= draft.total_rosters) {
      const roster = league.rosters.find((r: Roster) => r.user_id === userId)
      owners[slot - 1] = { username: roster?.username ?? userId.slice(0, 6), userId }
    }
  }
  return owners
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
  const posBg = POS_BG[pos] ?? 'bg-gray-700/30'
  const posText = POS_TEXT[pos] ?? 'text-gray-300'
  const borderColor = POS_BORDER[pos] ?? '#4B556330'
  const slot = String(pick.draft_slot).padStart(2, '0')
  const isTraded = originalOwnerId !== '' && pick.picked_by !== '' && pick.picked_by !== originalOwnerId

  return (
    <View className={`rounded px-1 py-1 ${posBg}`} style={{ width: CELL_WIDTH, borderWidth: 1, borderColor: isTraded ? '#F59E0B50' : borderColor }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-gray-500 text-[8px] font-mono">{pick.round}.{slot}</Text>
        <Text className={`text-[8px] font-bold ${posText}`}>{pos}</Text>
      </View>
      <Text className={`text-[10px] font-medium ${posText}`} numberOfLines={1}>{lastName}</Text>
      {isTraded ? (
        <View>
          <Text className="text-amber-400 text-[7px] font-bold" numberOfLines={1}>{pickerName}</Text>
          <Text className="text-gray-600 text-[6px]" numberOfLines={1}>via {originalOwnerName}</Text>
        </View>
      ) : (
        team ? <Text className="text-gray-500 text-[8px]">{team}</Text> : null
      )}
    </View>
  )
}

function EmptyCell({ round, slot, tradedTo }: { round: number; slot: number; tradedTo?: string }) {
  return (
    <View
      className="rounded px-1 py-1 bg-gray-800/50"
      style={{ width: CELL_WIDTH, borderWidth: 1, borderColor: tradedTo ? '#F59E0B30' : '#374151', borderStyle: 'dashed' }}
    >
      <Text className="text-gray-600 text-[8px] font-mono">{round}.{String(slot).padStart(2, '0')}</Text>
      {tradedTo ? (
        <Text className="text-amber-400/70 text-[8px] font-medium" numberOfLines={1}>{tradedTo}</Text>
      ) : (
        <Text className="text-gray-700 text-[10px]">—</Text>
      )}
    </View>
  )
}

function HeaderRow({ slotOwners }: { slotOwners: SlotOwner[] }) {
  return (
    <View className="flex-row items-stretch gap-1 mb-1">
      <View style={{ width: 26 }} />
      {slotOwners.map((owner, i) => (
        <View key={i} className="items-center justify-center rounded bg-gray-700/60 py-1" style={{ width: CELL_WIDTH }}>
          <Text className="text-gray-300 text-[8px] font-bold" numberOfLines={1}>{owner.username}</Text>
        </View>
      ))}
    </View>
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
  tradedSlots: Record<number, string> // slot -> new owner name (for untaken traded picks)
}) {
  const pickBySlot = useMemo(() => {
    const map = new Map<number, DraftPick>()
    for (const pick of picks) map.set(pick.draft_slot, pick)
    return map
  }, [picks])

  const cells = useMemo(() =>
    Array.from({ length: totalRosters }, (_, i) => {
      const slot = i + 1
      const pick = pickBySlot.get(slot)
      return { slot, pick }
    }),
  [pickBySlot, totalRosters])

  return (
    <View className="flex-row items-stretch gap-1 mb-1">
      <View className={`items-center justify-center rounded ${isCurrentRound ? 'bg-blue-500/20' : 'bg-gray-700/40'}`} style={{ width: 26 }}>
        <Text className={`text-[9px] font-bold ${isCurrentRound ? 'text-blue-400' : 'text-gray-500'}`}>
          R{round}
        </Text>
      </View>
      {cells.map(({ slot, pick }) =>
        pick
          ? <PickCell
              key={slot}
              pick={pick}
              allplayers={allplayers}
              originalOwnerId={slotOwners[slot - 1]?.userId ?? ''}
              pickerName={userIdToName[pick.picked_by] ?? ''}
              originalOwnerName={slotOwners[slot - 1]?.username ?? ''}
            />
          : <EmptyCell key={slot} round={round} slot={slot} tradedTo={tradedSlots[slot]} />,
      )}
    </View>
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
  userId: string | null
  otcCount: number // -1 = not active/no slot, 0 = OTC, >0 = picks away
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

  // Map user_id -> display name for traded pick labels
  const userIdToName = useMemo(() => {
    const map: Record<string, string> = {}
    if (league) {
      for (const r of league.rosters) map[r.user_id] = r.username
    }
    return map
  }, [league])

  // For each round, detect slots whose picks were traded (picked_by differs from slot owner)
  // For empty cells (not yet picked), we can detect traded slots from the draft picks data
  // by looking at picks where picked_by != original slot owner
  const tradedSlotsMap = useMemo(() => {
    // Build a map of which picks in completed rounds were traded, to show on empty future cells
    // We use draft_order to check: for each slot, who originally owns it, vs who picks from it
    const map: Record<number, string> = {}
    if (!draft.draft_order) return map
    // Check picks to find slots that have been traded
    for (const pick of draft.picks) {
      const origOwner = slotOwners[pick.draft_slot - 1]
      if (origOwner && pick.picked_by !== origOwner.userId) {
        map[pick.draft_slot] = userIdToName[pick.picked_by] ?? ''
      }
    }
    return map
  }, [draft.picks, draft.draft_order, slotOwners, userIdToName])

  // Players already drafted
  const draftedIds = useMemo(() => new Set(draft.picks.map((p) => p.player_id)), [draft.picks])
  const availablePlayerIds = useMemo(
    () => Object.keys(allplayers).filter((id) => !draftedIds.has(id) && allplayers[id]?.active),
    [allplayers, draftedIds],
  )

  const handlePick = useCallback(async (playerId: string) => {
    setPicking(true)
    try {
      await mobileDataClient.graphql('makeDraftPick', {
        draft_id: draft.draft_id,
        player_id: playerId,
      })
    } catch (e) {
      const { Alert } = require('react-native')
      Alert.alert('Pick Failed', e instanceof Error ? e.message : String(e))
    } finally {
      setPicking(false)
    }
  }, [draft.draft_id])

  return (
    <View className={`rounded-xl border p-3 mb-3 ${isOtc ? 'bg-green-900/20 border-green-500/50' : 'bg-gray-800 border-gray-700/80'}`}>
      {/* Header */}
      <TouchableOpacity onPress={() => setExpanded((p) => !p)} activeOpacity={0.7}>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-white font-semibold text-sm font-heading flex-1" numberOfLines={1}>
            {draft.league_name}
          </Text>
          <View className="flex-row items-center gap-2">
            {isOtc && (
              <View className="bg-green-500/30 px-2 py-0.5 rounded">
                <Text className="text-green-300 text-[11px] font-bold">OTC</Text>
              </View>
            )}
            {otcCount > 0 && (
              <Text className="text-yellow-400 text-[11px] font-medium">{otcCount} away</Text>
            )}
            <View className={`px-2 py-0.5 rounded ${statusStyle.bg}`}>
              <Text className={`text-[11px] font-medium ${statusStyle.text}`}>
                {STATUS_LABELS[draft.status] ?? draft.status}
              </Text>
            </View>
            <Text className="text-gray-500 text-[11px]">{draft.season}</Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-gray-400 text-xs">
            {draft.settings.rounds} rds · {draft.total_rosters} teams
          </Text>
          {draft.status === 'drafting' && (
            <Text className="text-green-400 text-xs font-medium">
              Rd {currentRound} · {totalPicks}/{totalSlots}
            </Text>
          )}
          {draft.status === 'complete' && (
            <Text className="text-gray-500 text-xs">{totalPicks} picks</Text>
          )}
          {draft.status === 'pre_draft' && (
            <Text className="text-yellow-400/70 text-xs">Not started</Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Pick UI — shown when OTC */}
      {isOtc && (
        <View className="mt-2 mb-1">
          <PlayerCombobox
            playerIds={availablePlayerIds}
            allplayers={allplayers}
            selected={[]}
            onSelect={handlePick}
            placeholder={picking ? 'Submitting pick...' : 'Search to pick...'}
          />
        </View>
      )}

      {/* Draft grid */}
      {draft.picks.length > 0 && (
        <View className="mt-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
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
            </View>
          </ScrollView>

          <TouchableOpacity onPress={() => setExpanded((p) => !p)} className="items-center pt-1.5">
            <Text className="text-blue-400 text-xs font-medium">
              {expanded ? 'Collapse' : `Show all ${rounds.length} rounds`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

type FilterTab = 'all' | 'drafting' | 'pre_draft' | 'complete'

function DraftsContent() {
  const { session } = useAuth()
  const { leagues, loading: leaguesLoading } = useLeagueCache()
  const { allplayers } = useAllPlayers()
  const safeLeagues = leagues ?? {}

  const { drafts, loading: draftsLoading, refetch, applyPick } = useDrafts(safeLeagues)

  const [filter, setFilter] = useState<FilterTab>('all')

  // Debounced refetch for structural changes (new drafts, draft status changes)
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => { refetch() }, 2000)
  }, [refetch])

  useGatewayTopic(
    session?.user_id ? SleeperTopics.user(session.user_id) : null,
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
  const liveDraftTopics = useMemo(
    () => drafts.filter((d) => d.status === 'drafting').map((d) => SleeperTopics.draft(d.draft_id)),
    [drafts],
  )

  useGatewayTopics(
    liveDraftTopics,
    useCallback(
      (event: string, payload: unknown) => {
        if (event === 'player_picked' && payload) {
          applyPick(payload as PlayerPickedPayload)
        }
      },
      [applyPick],
    ),
  )

  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try { await refetch() } finally { setRefreshing(false) }
  }, [refetch])

  // Sort live drafts by picks-till-OTC (OTC first), then rest by status
  const sortedDrafts = useMemo(() => {
    const uid = session?.user_id ?? ''
    return [...drafts].sort((a, b) => {
      const aOtc = picksTillOtc(a, uid)
      const bOtc = picksTillOtc(b, uid)
      // OTC (0) first, then by distance, then non-live (-1) last
      if (aOtc >= 0 && bOtc >= 0) return aOtc - bOtc
      if (aOtc >= 0) return -1
      if (bOtc >= 0) return 1
      // Non-live: drafting > pre_draft > complete
      const statusOrder: Record<string, number> = { drafting: 0, pre_draft: 1, complete: 2 }
      return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    })
  }, [drafts, session?.user_id])

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

  const isLoading = leaguesLoading || draftsLoading

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'drafting', label: 'Live', count: counts.drafting },
    { key: 'pre_draft', label: 'Upcoming', count: counts.pre_draft },
    { key: 'complete', label: 'Completed', count: counts.complete },
  ]

  return (
    <View className="flex-1 bg-gray-900">
      <View className="flex-row border-b border-gray-700 px-4">
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setFilter(t.key)}
            className={`px-4 py-3 mr-1 ${filter === t.key ? 'border-b-2 border-b-blue-400' : ''}`}
          >
            <Text
              className={`text-[13px] font-medium font-heading ${
                filter === t.key ? 'text-white' : 'text-gray-500'
              }`}
            >
              {t.label}
              {t.count > 0 ? ` (${t.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && filteredDrafts.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#60A5FA" />
        </View>
      ) : (
        <FlatList
          data={filteredDrafts}
          keyExtractor={(d) => d.draft_id}
          renderItem={({ item }) => (
            <DraftCard
              draft={item}
              allplayers={allplayers}
              leagues={safeLeagues}
              userId={session?.user_id ?? null}
              otcCount={picksTillOtc(item, session?.user_id ?? '')}
            />
          )}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text className="text-gray-400 text-[11px] text-center mt-10">
              No {filter === 'all' ? '' : STATUS_LABELS[filter]?.toLowerCase() + ' '}drafts found
            </Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#60A5FA"
              colors={['#60A5FA']}
            />
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}
    </View>
  )
}

export default function DraftsScreen() {
  return (
    <ErrorBoundary>
      <DraftsContent />
    </ErrorBoundary>
  )
}
