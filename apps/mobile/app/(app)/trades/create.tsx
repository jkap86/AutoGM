import { useState, useMemo, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, ScrollView, Modal,
} from 'react-native'
import type { LeagueDetailed, Roster, Allplayer } from '@autogm/shared'
import { getPickId, buildPlayerAttachment, buildUserAttachment } from '@autogm/shared'
import { useAuth } from '@autogm/shared/react'
import { useLeagueCache } from '../../../src/league-cache'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { useKtc } from '../../../src/hooks/use-ktc'
import { mobileDataClient } from '../../../src/data-client'
import { RosterColumn } from '../../../src/components/roster-column'

function PlayerSearchModal({
  visible,
  playerIds,
  allplayers,
  ktc,
  selected,
  onSelect,
  onClose,
  title,
}: {
  visible: boolean
  playerIds: string[]
  allplayers: Record<string, Allplayer>
  ktc: Record<string, number>
  selected: string[]
  onSelect: (id: string) => void
  onClose: () => void
  title: string
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return playerIds
      .filter((id) => !selected.includes(id))
      .filter((id) => {
        if (!q) return true
        const p = allplayers[id]
        return (p?.full_name || id).toLowerCase().includes(q)
      })
      .sort((a, b) => (ktc[b] ?? 0) - (ktc[a] ?? 0))
      .slice(0, 50)
  }, [playerIds, allplayers, ktc, query, selected])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-gray-900">
        <View className="flex-row justify-between items-center p-4 border-b border-gray-700">
          <Text className="text-white text-[17px] font-bold">{title}</Text>
          <TouchableOpacity onPress={() => { onClose(); setQuery('') }}>
            <Text className="text-blue-400 text-[15px]">Done</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search players..."
          placeholderTextColor="#6B7280"
          className="bg-gray-800 rounded-lg mx-4 mt-2 mb-4 px-3 py-2.5 text-gray-100 text-sm border border-gray-700"
          autoFocus
        />
        <FlatList
          data={filtered}
          keyExtractor={(id) => id}
          renderItem={({ item: id }) => {
            const p = allplayers[id]
            const value = ktc[id] ?? 0
            return (
              <TouchableOpacity className="flex-row items-center px-4 py-2.5 border-b border-gray-700/25" onPress={() => { onSelect(id); setQuery('') }}>
                <View className="flex-1">
                  <Text className="text-gray-100 text-sm font-medium">{p?.full_name || id}</Text>
                  <Text className="text-gray-500 text-xs mt-px">{p?.position ?? '?'} - {p?.team ?? 'FA'}</Text>
                </View>
                {value > 0 && <Text className="text-blue-400 text-[13px] font-semibold">{value}</Text>}
              </TouchableOpacity>
            )
          }}
        />
      </View>
    </Modal>
  )
}

function Chip({ label, value, chipColor, onRemove }: { label: string; value?: number; chipColor: string; onRemove: () => void }) {
  return (
    <View className="flex-row items-center border rounded-full px-2.5 py-1.5 mb-1" style={{ borderColor: chipColor + '60', backgroundColor: chipColor + '15' }}>
      <Text className="text-xs font-medium" style={{ color: chipColor }}>{label}</Text>
      {value != null && value > 0 && <Text className="text-[10px] ml-1" style={{ color: chipColor + 'AA' }}>{value}</Text>}
      <TouchableOpacity onPress={onRemove} hitSlop={8}>
        <Text className="text-base ml-1" style={{ color: chipColor }}>x</Text>
      </TouchableOpacity>
    </View>
  )
}

function TradeMatchCard({
  league,
  partner,
  playersToGive,
  playersToReceive,
  picksToGive,
  picksToReceive,
  allplayers,
  ktc,
  onSend,
  sending,
}: {
  league: LeagueDetailed
  partner: Roster
  playersToGive: string[]
  playersToReceive: string[]
  picksToGive: string[]
  picksToReceive: string[]
  allplayers: Record<string, Allplayer>
  ktc: Record<string, number>
  onSend: () => void
  sending: boolean
}) {
  const giveTotal = playersToGive.reduce((s, id) => s + (ktc[id] ?? 0), 0)
  const receiveTotal = playersToReceive.reduce((s, id) => s + (ktc[id] ?? 0), 0)

  return (
    <View className="bg-gray-800 rounded-xl p-3.5 mb-2">
      <View className="flex-row items-center mb-2">
        <View className="flex-1">
          <Text className="text-white text-sm font-semibold">{league.name}</Text>
          <Text className="text-gray-500 text-xs mt-px">with {partner.username} ({partner.wins}-{partner.losses})</Text>
        </View>
        <TouchableOpacity
          className={`bg-blue-600 rounded-lg px-3.5 py-1.5 ${sending ? 'opacity-50' : ''}`}
          onPress={onSend}
          disabled={sending}
        >
          <Text className="text-white text-[13px] font-semibold">{sending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="text-red-400 text-[11px] font-bold mb-1">Give ({giveTotal.toLocaleString()})</Text>
          {playersToGive.map((id) => (
            <Text key={id} className="text-gray-100 text-xs mb-px" numberOfLines={1}>{allplayers[id]?.full_name || id}</Text>
          ))}
          {picksToGive.map((id) => <Text key={id} className="text-gray-100 text-xs mb-px">{id}</Text>)}
        </View>
        <View className="flex-1">
          <Text className="text-green-400 text-[11px] font-bold mb-1">Get ({receiveTotal.toLocaleString()})</Text>
          {playersToReceive.map((id) => (
            <Text key={id} className="text-gray-100 text-xs mb-px" numberOfLines={1}>{allplayers[id]?.full_name || id}</Text>
          ))}
          {picksToReceive.map((id) => <Text key={id} className="text-gray-100 text-xs mb-px">{id}</Text>)}
        </View>
      </View>
    </View>
  )
}

const SUBMIT_DELAY_MS = 2000
const SUBMIT_JITTER_MS = 2000

export default function CreateTradeScreen() {
  const { session } = useAuth()
  const { leagues, playerShares, pickShares, loading: leaguesLoading } = useLeagueCache()
  const { allplayers } = useAllPlayers()
  const { ktc } = useKtc()

  const [playersToGive, setPlayersToGive] = useState<string[]>([])
  const [playersToReceive, setPlayersToReceive] = useState<string[]>([])
  const [picksToGive, setPicksToGive] = useState<string[]>([])
  const [picksToReceive, setPicksToReceive] = useState<string[]>([])
  const [showGiveSearch, setShowGiveSearch] = useState(false)
  const [showReceiveSearch, setShowReceiveSearch] = useState(false)
  const [showGivePicks, setShowGivePicks] = useState(false)
  const [showReceivePicks, setShowReceivePicks] = useState(false)
  const [sendingKey, setSendingKey] = useState<string | null>(null)
  // Roster filters
  const [userOwnsFilter, setUserOwnsFilter] = useState<string[]>([])
  const [userLacksFilter, setUserLacksFilter] = useState<string[]>([])
  const [partnerOwnsFilter, setPartnerOwnsFilter] = useState<string[]>([])
  const [partnerLacksFilter, setPartnerLacksFilter] = useState<string[]>([])
  const [showFilterModal, setShowFilterModal] = useState<'userOwns' | 'userLacks' | 'partnerOwns' | 'partnerLacks' | null>(null)
  // Batch send
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set())
  const [batchSending, setBatchSending] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [rostersExpanded, setRostersExpanded] = useState(false)

  const allPlayerIds = useMemo(() => Object.keys(allplayers), [allplayers])

  const ownedPlayers = useMemo(
    () => Object.keys(playerShares).filter((id) => playerShares[id].owned.length > 0),
    [playerShares],
  )
  const takenPlayers = useMemo(
    () => Object.keys(playerShares).filter((id) => playerShares[id].taken.length > 0),
    [playerShares],
  )
  const ownedPicks = useMemo(
    () => Object.keys(pickShares).filter((id) => pickShares[id].owned.length > 0),
    [pickShares],
  )
  const takenPicks = useMemo(
    () => Object.keys(pickShares).filter((id) => pickShares[id].taken.length > 0),
    [pickShares],
  )

  // Filter leagues to those matching selected assets
  const filteredMatches = useMemo(() => {
    if (!leagues) return []
    const hasAnything = playersToGive.length + playersToReceive.length + picksToGive.length + picksToReceive.length > 0
    if (!hasAnything) return []

    return Object.values(leagues).flatMap((league) => {
      const userRoster = league.user_roster
      const hasPlayersToGive = playersToGive.every((pid) => userRoster.players.includes(pid))
      const hasPicksToGive = picksToGive.every((pid) => userRoster.draftpicks.some((d) => getPickId(d) === pid))
      if (!hasPlayersToGive || !hasPicksToGive) return []
      // Roster filters on user
      if (!userOwnsFilter.every((pid) => userRoster.players.includes(pid))) return []
      if (!userLacksFilter.every((pid) => !userRoster.players.includes(pid))) return []

      return league.rosters
        .filter((r) => r.roster_id !== userRoster.roster_id)
        .filter((r) =>
          playersToReceive.every((pid) => r.players.includes(pid)) &&
          picksToReceive.every((pid) => r.draftpicks.some((d) => getPickId(d) === pid)) &&
          partnerOwnsFilter.every((pid) => r.players.includes(pid)) &&
          partnerLacksFilter.every((pid) => !r.players.includes(pid)),
        )
        .map((partner) => ({ league, partner }))
    })
  }, [leagues, playersToGive, playersToReceive, picksToGive, picksToReceive, userOwnsFilter, userLacksFilter, partnerOwnsFilter, partnerLacksFilter])

  const sendTrade = useCallback(async (league: LeagueDetailed, partner: Roster) => {
    const key = `${league.league_id}-${partner.roster_id}`
    setSendingKey(key)
    try {
      const userRoster = league.user_roster
      await mobileDataClient.graphql('proposeTrade', {
        league_id: league.league_id,
        k_adds: [...playersToGive, ...playersToReceive],
        v_adds: [
          ...playersToGive.map(() => partner.roster_id),
          ...playersToReceive.map(() => userRoster.roster_id),
        ],
        k_drops: [...playersToGive, ...playersToReceive],
        v_drops: [
          ...playersToGive.map(() => userRoster.roster_id),
          ...playersToReceive.map(() => partner.roster_id),
        ],
        draft_picks: [
          ...picksToGive.flatMap((pickId) => {
            const pick = userRoster.draftpicks.find((d) => getPickId(d) === pickId)
            if (!pick) return []
            return [`${pick.roster_id},${pick.season},${pick.round},${partner.roster_id},${userRoster.roster_id}`]
          }),
          ...picksToReceive.flatMap((pickId) => {
            const pick = partner.draftpicks.find((d) => getPickId(d) === pickId)
            if (!pick) return []
            return [`${pick.roster_id},${pick.season},${pick.round},${userRoster.roster_id},${partner.roster_id}`]
          }),
        ],
        waiver_budget: [],
        expires_at: expiresAt,
      })

      // Send DM notification (non-blocking)
      try {
        const partnerId = partner.user_id
        const userId = session?.user_id
        if (partnerId && userId) {
          const dmResult = await mobileDataClient.graphql('getDmByMembers', { members: [userId, partnerId] })
          let dmId = (dmResult as any).get_dm_by_members?.dm_id
          if (!dmId) {
            const newDm = await mobileDataClient.graphql('createDm', { members: [userId, partnerId], dm_type: 'direct' })
            dmId = (newDm as any).create_dm?.dm_id
          }
          if (dmId) {
            const transactionsByRoster: Record<string, unknown> = {
              [userRoster.roster_id]: {
                adds: playersToReceive.map((pid) => buildPlayerAttachment(allplayers[pid])),
                drops: [],
                added_picks: picksToReceive.flatMap((pickId) => {
                  const pick = partner.draftpicks.find((d) => getPickId(d) === pickId)
                  if (!pick) return []
                  return [{ roster_id: String(pick.roster_id), season: pick.season, round: String(pick.round), owner_id: userId, previous_owner_id: partnerId }]
                }),
                dropped_picks: [], added_budget: [], dropped_budget: [],
                status: 'proposed',
                user: buildUserAttachment(userRoster, league.league_id),
              },
              [partner.roster_id]: {
                adds: playersToGive.map((pid) => buildPlayerAttachment(allplayers[pid])),
                drops: [],
                added_picks: picksToGive.flatMap((pickId) => {
                  const pick = userRoster.draftpicks.find((d) => getPickId(d) === pickId)
                  if (!pick) return []
                  return [{ roster_id: String(pick.roster_id), season: pick.season, round: String(pick.round), owner_id: partnerId, previous_owner_id: userId }]
                }),
                dropped_picks: [], added_budget: [], dropped_budget: [],
                status: 'proposed',
                user: buildUserAttachment(partner, league.league_id),
              },
            }
            await mobileDataClient.graphql('createMessage', {
              parent_id: dmId,
              text: `Trade proposed in ${league.name}`,
              attachment_type: 'trade_dm',
              k_attachment_data: ['status', 'transactions_by_roster', 'league_id'],
              v_attachment_data: ['proposed', JSON.stringify(transactionsByRoster), league.league_id],
            } as any)
          }
        }
      } catch {} // DM failure shouldn't block trade

      Alert.alert('Sent', `Trade sent to ${partner.username} in ${league.name}`)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSendingKey(null)
    }
  }, [playersToGive, playersToReceive, picksToGive, picksToReceive, expiresAt, session?.user_id, allplayers])

  const toggleSelected = useCallback((key: string) => {
    setSelectedTrades((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  const batchSend = useCallback(async () => {
    const toSend = filteredMatches.filter(({ league, partner }) =>
      selectedTrades.has(`${league.league_id}-${partner.roster_id}`),
    )
    if (toSend.length === 0) return
    setBatchSending(true)
    setBatchProgress(0)
    for (let i = 0; i < toSend.length; i++) {
      try { await sendTrade(toSend[i].league, toSend[i].partner) } catch {}
      setBatchProgress(i + 1)
      if (i < toSend.length - 1) await new Promise((r) => setTimeout(r, SUBMIT_DELAY_MS + Math.random() * SUBMIT_JITTER_MS))
    }
    setBatchSending(false)
    setSelectedTrades(new Set())
    Alert.alert('Done', `Sent ${toSend.length} trade proposals`)
  }, [filteredMatches, selectedTrades, sendTrade])

  const giveTotal = playersToGive.reduce((s, id) => s + (ktc[id] ?? 0), 0)
  const receiveTotal = playersToReceive.reduce((s, id) => s + (ktc[id] ?? 0), 0)

  if (leaguesLoading) {
    return <View className="flex-1 bg-gray-900 items-center justify-center"><ActivityIndicator size="large" color="#60A5FA" /></View>
  }

  return (
    <ScrollView className="flex-1 bg-gray-900" contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      {/* You Give */}
      <View className="bg-gray-800 rounded-xl p-3.5 mb-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-red-400 text-[13px] font-bold uppercase tracking-wide">You Give</Text>
          {giveTotal > 0 && <Text className="text-gray-500 text-xs">{giveTotal.toLocaleString()}</Text>}
        </View>
        <View className="flex-row gap-2 mb-2">
          <TouchableOpacity className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 items-center" onPress={() => setShowGiveSearch(true)}>
            <Text className="text-gray-500 text-[13px] font-medium">+ Player</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 items-center" onPress={() => setShowGivePicks(true)}>
            <Text className="text-gray-500 text-[13px] font-medium">+ Pick</Text>
          </TouchableOpacity>
        </View>
        {playersToGive.length > 0 && (
          <View className="flex-row flex-wrap gap-1">
            {playersToGive.map((id) => (
              <Chip key={id} label={allplayers[id]?.full_name || id} value={ktc[id]} chipColor="#F87171"
                onRemove={() => setPlayersToGive((p) => p.filter((x) => x !== id))} />
            ))}
          </View>
        )}
        {picksToGive.map((id) => (
          <Chip key={id} label={id} chipColor="#F87171"
            onRemove={() => setPicksToGive((p) => p.filter((x) => x !== id))} />
        ))}
      </View>

      {/* You Receive */}
      <View className="bg-gray-800 rounded-xl p-3.5 mb-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-green-400 text-[13px] font-bold uppercase tracking-wide">You Receive</Text>
          {receiveTotal > 0 && <Text className="text-gray-500 text-xs">{receiveTotal.toLocaleString()}</Text>}
        </View>
        <View className="flex-row gap-2 mb-2">
          <TouchableOpacity className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 items-center" onPress={() => setShowReceiveSearch(true)}>
            <Text className="text-gray-500 text-[13px] font-medium">+ Player</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 items-center" onPress={() => setShowReceivePicks(true)}>
            <Text className="text-gray-500 text-[13px] font-medium">+ Pick</Text>
          </TouchableOpacity>
        </View>
        {playersToReceive.length > 0 && (
          <View className="flex-row flex-wrap gap-1">
            {playersToReceive.map((id) => (
              <Chip key={id} label={allplayers[id]?.full_name || id} value={ktc[id]} chipColor="#4ADE80"
                onRemove={() => setPlayersToReceive((p) => p.filter((x) => x !== id))} />
            ))}
          </View>
        )}
        {picksToReceive.map((id) => (
          <Chip key={id} label={id} chipColor="#4ADE80"
            onRemove={() => setPicksToReceive((p) => p.filter((x) => x !== id))} />
        ))}
      </View>

      {/* Roster Filters */}
      <View className="bg-gray-800 rounded-xl p-3.5 mb-3">
        <Text className="text-gray-500 text-[13px] font-bold uppercase tracking-wide mb-2">Roster Filters</Text>
        <View className="flex-row gap-2 mb-2">
          <TouchableOpacity className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 items-center" onPress={() => setShowFilterModal('userOwns')}>
            <Text className="text-gray-500 text-[13px] font-medium">You Own</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 items-center" onPress={() => setShowFilterModal('userLacks')}>
            <Text className="text-gray-500 text-[13px] font-medium">You Lack</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row gap-2 mb-2">
          <TouchableOpacity className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 items-center" onPress={() => setShowFilterModal('partnerOwns')}>
            <Text className="text-gray-500 text-[13px] font-medium">Ptr Owns</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 items-center" onPress={() => setShowFilterModal('partnerLacks')}>
            <Text className="text-gray-500 text-[13px] font-medium">Ptr Lacks</Text>
          </TouchableOpacity>
        </View>
        {userOwnsFilter.length > 0 && <View className="flex-row flex-wrap gap-1">{userOwnsFilter.map((id) => (
          <Chip key={id} label={allplayers[id]?.full_name || id} chipColor="#60A5FA" onRemove={() => setUserOwnsFilter((p) => p.filter((x) => x !== id))} />
        ))}</View>}
        {userLacksFilter.length > 0 && <View className="flex-row flex-wrap gap-1">{userLacksFilter.map((id) => (
          <Chip key={id} label={allplayers[id]?.full_name || id} chipColor="#FB923C" onRemove={() => setUserLacksFilter((p) => p.filter((x) => x !== id))} />
        ))}</View>}
        {partnerOwnsFilter.length > 0 && <View className="flex-row flex-wrap gap-1">{partnerOwnsFilter.map((id) => (
          <Chip key={id} label={allplayers[id]?.full_name || id} chipColor="#60A5FA" onRemove={() => setPartnerOwnsFilter((p) => p.filter((x) => x !== id))} />
        ))}</View>}
        {partnerLacksFilter.length > 0 && <View className="flex-row flex-wrap gap-1">{partnerLacksFilter.map((id) => (
          <Chip key={id} label={allplayers[id]?.full_name || id} chipColor="#FB923C" onRemove={() => setPartnerLacksFilter((p) => p.filter((x) => x !== id))} />
        ))}</View>}
      </View>

      {/* Expiration */}
      <View className="bg-gray-800 rounded-xl p-3.5 mb-3">
        <Text className="text-gray-500 text-[13px] font-bold uppercase tracking-wide mb-2">Expiration</Text>
        <View className="flex-row gap-2">
          {([
            { label: 'None', days: null },
            { label: '1 Day', days: 1 },
            { label: '3 Days', days: 3 },
            { label: '7 Days', days: 7 },
          ] as const).map(({ label, days }) => {
            const isSelected = days === null ? expiresAt === null : (expiresAt != null && Math.round((expiresAt - Date.now()) / 86400000) === days)
            return (
              <TouchableOpacity
                key={label}
                className={`flex-1 rounded-lg p-2.5 items-center border ${isSelected ? 'bg-blue-600/20 border-blue-400' : 'bg-gray-900 border-gray-700'}`}
                onPress={() => setExpiresAt(days === null ? null : Date.now() + days * 86400000)}
              >
                <Text className={`text-[13px] font-medium ${isSelected ? 'text-blue-400' : 'text-gray-500'}`}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        {expiresAt != null && (
          <Text className="text-gray-400 text-xs mt-2">
            Expires: {new Date(expiresAt).toLocaleDateString()} {new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {/* Rosters */}
      {filteredMatches.length > 0 && (
        <View className="bg-gray-800 rounded-xl p-3.5 mb-3">
          <TouchableOpacity
            className="flex-row justify-between items-center"
            onPress={() => setRostersExpanded((v) => !v)}
          >
            <Text className="text-gray-400 text-[13px] font-bold uppercase tracking-wide">
              View Rosters {rostersExpanded ? '\u25B2' : '\u25BC'}
            </Text>
          </TouchableOpacity>
          {rostersExpanded && filteredMatches[0] && (
            <View className="flex-row gap-2 mt-2">
              <RosterColumn
                roster={filteredMatches[0].league.user_roster}
                allplayers={allplayers}
                label={filteredMatches[0].league.user_roster.username ?? 'You'}
                valueLookup={ktc}
                formatValue={(n) => Math.round(n).toLocaleString()}
              />
              <RosterColumn
                roster={filteredMatches[0].partner}
                allplayers={allplayers}
                label={filteredMatches[0].partner.username ?? 'Partner'}
                valueLookup={ktc}
                formatValue={(n) => Math.round(n).toLocaleString()}
              />
            </View>
          )}
        </View>
      )}

      {/* Potential Trades */}
      {filteredMatches.length > 0 ? (
        <View>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-400 text-sm font-semibold mb-2 mt-1">
              {filteredMatches.length} potential {filteredMatches.length === 1 ? 'trade' : 'trades'}
              {selectedTrades.size > 0 ? ` · ${selectedTrades.size} selected` : ''}
            </Text>
            {selectedTrades.size > 0 && (
              <TouchableOpacity
                className={`bg-blue-600 rounded-lg px-3.5 py-1.5 ${batchSending ? 'opacity-50' : ''}`}
                onPress={batchSend}
                disabled={batchSending}
              >
                <Text className="text-white text-[13px] font-semibold">
                  {batchSending ? `${batchProgress}/${selectedTrades.size}...` : `Send ${selectedTrades.size}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {filteredMatches.map(({ league, partner }) => {
            const key = `${league.league_id}-${partner.roster_id}`
            return (
              <TouchableOpacity key={key} onLongPress={() => toggleSelected(key)} activeOpacity={0.8}>
                <View className={selectedTrades.has(key) ? 'bg-gray-800 rounded-xl p-3.5 mb-2 border border-blue-400' : ''}>
            <TradeMatchCard
              key={`${league.league_id}-${partner.roster_id}`}
              league={league}
              partner={partner}
              playersToGive={playersToGive}
              playersToReceive={playersToReceive}
              picksToGive={picksToGive}
              picksToReceive={picksToReceive}
              allplayers={allplayers}
              ktc={ktc}
              sending={sendingKey === `${league.league_id}-${partner.roster_id}`}
              onSend={() => Alert.alert(
                'Send Trade?',
                `Send to ${partner.username} in ${league.name}?`,
                [{ text: 'Cancel', style: 'cancel' }, { text: 'Send', onPress: () => sendTrade(league, partner) }],
              )}
            />
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      ) : (playersToGive.length + playersToReceive.length + picksToGive.length + picksToReceive.length > 0) ? (
        <Text className="text-gray-500 text-[13px] text-center mt-6">No matching leagues for these players/picks.</Text>
      ) : (
        <Text className="text-gray-500 text-[13px] text-center mt-6">Select players or picks above to find trades.</Text>
      )}

      {/* Modals */}
      <PlayerSearchModal
        visible={showGiveSearch}
        playerIds={ownedPlayers}
        allplayers={allplayers}
        ktc={ktc}
        selected={[...playersToGive, ...playersToReceive]}
        onSelect={(id) => setPlayersToGive((p) => [...p, id])}
        onClose={() => setShowGiveSearch(false)}
        title="Your Players"
      />
      <PlayerSearchModal
        visible={showReceiveSearch}
        playerIds={takenPlayers}
        allplayers={allplayers}
        ktc={ktc}
        selected={[...playersToGive, ...playersToReceive]}
        onSelect={(id) => setPlayersToReceive((p) => [...p, id])}
        onClose={() => setShowReceiveSearch(false)}
        title="Players to Receive"
      />
      <PlayerSearchModal
        visible={showGivePicks}
        playerIds={ownedPicks}
        allplayers={allplayers}
        ktc={ktc}
        selected={[...picksToGive, ...picksToReceive]}
        onSelect={(id) => setPicksToGive((p) => [...p, id])}
        onClose={() => setShowGivePicks(false)}
        title="Your Picks"
      />
      <PlayerSearchModal
        visible={showReceivePicks}
        playerIds={takenPicks}
        allplayers={allplayers}
        ktc={ktc}
        selected={[...picksToGive, ...picksToReceive]}
        onSelect={(id) => setPicksToReceive((p) => [...p, id])}
        onClose={() => setShowReceivePicks(false)}
        title="Picks to Receive"
      />
      <PlayerSearchModal
        visible={showFilterModal === 'userOwns'}
        playerIds={allPlayerIds}
        allplayers={allplayers}
        ktc={ktc}
        selected={[...userOwnsFilter, ...userLacksFilter, ...partnerOwnsFilter, ...partnerLacksFilter]}
        onSelect={(id) => setUserOwnsFilter((p) => [...p, id])}
        onClose={() => setShowFilterModal(null)}
        title="You Must Own"
      />
      <PlayerSearchModal
        visible={showFilterModal === 'userLacks'}
        playerIds={allPlayerIds}
        allplayers={allplayers}
        ktc={ktc}
        selected={[...userOwnsFilter, ...userLacksFilter, ...partnerOwnsFilter, ...partnerLacksFilter]}
        onSelect={(id) => setUserLacksFilter((p) => [...p, id])}
        onClose={() => setShowFilterModal(null)}
        title="You Must NOT Own"
      />
      <PlayerSearchModal
        visible={showFilterModal === 'partnerOwns'}
        playerIds={allPlayerIds}
        allplayers={allplayers}
        ktc={ktc}
        selected={[...userOwnsFilter, ...userLacksFilter, ...partnerOwnsFilter, ...partnerLacksFilter]}
        onSelect={(id) => setPartnerOwnsFilter((p) => [...p, id])}
        onClose={() => setShowFilterModal(null)}
        title="Partner Must Own"
      />
      <PlayerSearchModal
        visible={showFilterModal === 'partnerLacks'}
        playerIds={allPlayerIds}
        allplayers={allplayers}
        ktc={ktc}
        selected={[...userOwnsFilter, ...userLacksFilter, ...partnerOwnsFilter, ...partnerLacksFilter]}
        onSelect={(id) => setPartnerLacksFilter((p) => [...p, id])}
        onClose={() => setShowFilterModal(null)}
        title="Partner Must NOT Own"
      />
    </ScrollView>
  )
}

