import { useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useAuth } from '@autogm/shared/react'
import type { Allplayer } from '@autogm/shared'
import { SleeperTopics } from '@autogm/shared'
import { useLeagueCache } from '../../../src/league-cache'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { useDrafts, type DraftWithLeague, type DraftPick } from '../../../src/hooks/use-drafts'
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

function getCurrentRound(draft: DraftWithLeague): number {
  if (draft.picks.length === 0) return 1
  const lastPick = draft.picks[draft.picks.length - 1]
  return lastPick.round
}

function getPicksByRound(picks: DraftPick[]): Record<number, DraftPick[]> {
  const byRound: Record<number, DraftPick[]> = {}
  for (const pick of picks) {
    if (!byRound[pick.round]) byRound[pick.round] = []
    byRound[pick.round].push(pick)
  }
  return byRound
}

const POS_COLORS: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-orange-400',
  K: 'text-purple-400',
  DEF: 'text-yellow-400',
}

function PickRow({
  pick,
  allplayers,
}: {
  pick: DraftPick
  allplayers: Record<string, Allplayer>
}) {
  const player = allplayers[pick.player_id]
  const name = player
    ? `${player.first_name} ${player.last_name}`
    : pick.metadata?.first_name
      ? `${pick.metadata.first_name} ${pick.metadata.last_name}`
      : pick.player_id
  const pos = player?.position ?? pick.metadata?.position ?? '?'
  const team = player?.team ?? pick.metadata?.team ?? 'FA'
  const posColor = POS_COLORS[pos] ?? 'text-gray-400'
  const slot = String(pick.draft_slot).padStart(2, '0')
  const pickLabel = `${pick.round}.${slot}`

  return (
    <View className="flex-row items-center py-1 px-2">
      <Text className="text-gray-500 text-[11px] font-mono w-10">{pickLabel}</Text>
      <Text className={`text-[11px] font-semibold w-8 ${posColor}`}>{pos}</Text>
      <Text className="text-gray-100 text-xs flex-1" numberOfLines={1}>
        {name}
      </Text>
      <Text className="text-gray-500 text-[11px] w-8 text-right">{team}</Text>
    </View>
  )
}

function RoundSection({
  round,
  picks,
  allplayers,
  totalRosters,
  isCurrentRound,
}: {
  round: number
  picks: DraftPick[]
  allplayers: Record<string, Allplayer>
  totalRosters: number
  isCurrentRound: boolean
}) {
  return (
    <View className="mb-2">
      <View className={`flex-row items-center px-2 py-1.5 rounded-t ${isCurrentRound ? 'bg-blue-500/15' : 'bg-gray-700/50'}`}>
        <Text className={`text-[11px] font-bold ${isCurrentRound ? 'text-blue-400' : 'text-gray-400'}`}>
          Round {round}
        </Text>
        <Text className="text-gray-500 text-[10px] ml-2">
          {picks.length}/{totalRosters} picks
        </Text>
        {isCurrentRound && (
          <View className="bg-green-500/20 px-1.5 py-0.5 rounded ml-2">
            <Text className="text-green-400 text-[9px] font-bold">LIVE</Text>
          </View>
        )}
      </View>
      {picks.map((pick) => (
        <PickRow
          key={pick.pick_no}
          pick={pick}
          allplayers={allplayers}
        />
      ))}
    </View>
  )
}

function DraftCard({
  draft,
  allplayers,
}: {
  draft: DraftWithLeague
  allplayers: Record<string, Allplayer>
}) {
  const [expanded, setExpanded] = useState(false)
  const [prevStatus, setPrevStatus] = useState(draft.status)
  if (draft.status !== prevStatus) {
    setPrevStatus(draft.status)
    if (draft.status === 'drafting') setExpanded(true)
  }
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

  // For live drafts, show next pick info
  const nextPickInfo = useMemo(() => {
    if (draft.status !== 'drafting') return null
    const nextPickNo = draft.picks.length + 1
    if (nextPickNo > totalSlots) return null
    const nextRound = Math.ceil(nextPickNo / draft.total_rosters)
    return { round: nextRound, pickNo: nextPickNo }
  }, [draft.status, draft.picks.length, draft.total_rosters, totalSlots])

  return (
    <View className="bg-gray-800 rounded-xl border border-gray-700/80 p-4 mb-3">
      {/* Header */}
      <TouchableOpacity
        onPress={() => setExpanded((p) => !p)}
        activeOpacity={0.7}
      >
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-white font-semibold text-sm font-heading flex-1" numberOfLines={1}>
            {draft.league_name}
          </Text>
          <View className="flex-row items-center gap-2">
            <View className={`px-2 py-0.5 rounded ${statusStyle.bg}`}>
              <Text className={`text-[11px] font-medium ${statusStyle.text}`}>
                {STATUS_LABELS[draft.status] ?? draft.status}
              </Text>
            </View>
            <Text className="text-gray-500 text-[11px]">{draft.season}</Text>
          </View>
        </View>

        {/* Collapsed summary */}
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-400 text-xs">
            {draft.settings.rounds} rounds · {draft.total_rosters} teams
          </Text>
          {draft.status === 'drafting' && (
            <Text className="text-green-400 text-xs font-medium">
              Round {currentRound} · {totalPicks}/{totalSlots} picks
            </Text>
          )}
          {draft.status === 'complete' && (
            <Text className="text-gray-500 text-xs">
              {totalPicks} picks
            </Text>
          )}
          {draft.status === 'pre_draft' && (
            <Text className="text-yellow-400/70 text-xs">
              Not started
            </Text>
          )}
        </View>

        {/* Next pick indicator */}
        {draft.status === 'drafting' && nextPickInfo && (
          <View className="mt-2 px-2 py-1.5 rounded bg-gray-700/50">
            <Text className="text-xs font-medium text-gray-300">
              Next: Pick #{nextPickInfo.pickNo} (Round {nextPickInfo.round})
            </Text>
          </View>
        )}

        {/* Expand indicator */}
        {draft.picks.length > 0 && (
          <View className="items-center pt-1.5">
            <Text className="text-blue-400 text-xs font-medium">
              {expanded ? 'Hide Board' : 'View Board'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Expanded draft board */}
      {expanded && draft.picks.length > 0 && (
        <View className="border-t border-gray-700 mt-2 pt-2">
          {rounds.map((round) => (
            <RoundSection
              key={round}
              round={round}
              picks={picksByRound[round]}
              allplayers={allplayers}
              totalRosters={draft.total_rosters}
              isCurrentRound={draft.status === 'drafting' && round === currentRound}
            />
          ))}
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

  const { drafts, loading: draftsLoading, refetch } = useDrafts(safeLeagues)

  const [filter, setFilter] = useState<FilterTab>('all')

  // Real-time updates: listen for draft-related events on user topic
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => { refetch() }, 2000)
  }, [refetch])

  useGatewayTopic(
    session?.user_id ? SleeperTopics.user(session.user_id) : null,
    useCallback(
      (event: string) => {
        if (event === 'draft_picked' || event === 'draft_created' || event === 'draft_traded_pick') {
          debouncedRefetch()
        }
      },
      [debouncedRefetch],
    ),
  )

  // Subscribe to all live draft topics for player_picked events
  const liveDraftTopics = useMemo(
    () => drafts.filter((d) => d.status === 'drafting').map((d) => SleeperTopics.draft(d.draft_id)),
    [drafts],
  )

  useGatewayTopics(
    liveDraftTopics,
    useCallback(
      (event: string) => {
        if (event === 'player_picked') debouncedRefetch()
      },
      [debouncedRefetch],
    ),
  )

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try { await refetch() } finally { setRefreshing(false) }
  }, [refetch])

  const filteredDrafts = useMemo(() => {
    if (filter === 'all') return drafts
    return drafts.filter((d) => d.status === filter)
  }, [drafts, filter])

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
      {/* Filter tabs */}
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
