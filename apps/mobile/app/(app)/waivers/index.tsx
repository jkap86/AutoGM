import { useState, useMemo, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, ScrollView, Modal,
} from 'react-native'
import type { LeagueDetailed, Allplayer } from '@autogm/shared'
import { useAuth } from '@autogm/shared/react'
import { useLeagueCache } from '../../../src/league-cache'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { useKtc } from '../../../src/hooks/use-ktc'
import { mobileDataClient } from '../../../src/data-client'

/* ------------------------------------------------------------------ */
/*  PlayerSearchModal                                                  */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Chip                                                               */
/* ------------------------------------------------------------------ */

function Chip({ label, chipColor, onRemove }: { label: string; chipColor: string; onRemove: () => void }) {
  return (
    <View className="flex-row items-center border rounded-full px-2.5 py-1.5 mb-1" style={{ borderColor: chipColor + '60', backgroundColor: chipColor + '15' }}>
      <Text className="text-xs font-medium" style={{ color: chipColor }}>{label}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={8}>
        <Text className="text-base ml-1" style={{ color: chipColor }}>x</Text>
      </TouchableOpacity>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  WaiverLeagueCard                                                   */
/* ------------------------------------------------------------------ */

function WaiverLeagueCard({
  league,
  bidValue,
  onBidChange,
  onSubmit,
  submitting,
  selected,
  onLongPress,
}: {
  league: LeagueDetailed
  bidValue: string
  onBidChange: (v: string) => void
  onSubmit: () => void
  submitting: boolean
  selected: boolean
  onLongPress: () => void
}) {
  const totalBudget = league.settings.waiver_budget ?? 100
  const used = league.user_roster.waiver_budget_used ?? 0
  const remaining = totalBudget - used
  const pct = totalBudget > 0 ? (used / totalBudget) * 100 : 0

  return (
    <TouchableOpacity activeOpacity={0.8} onLongPress={onLongPress}>
      <View className={`bg-gray-800 rounded-xl p-3.5 mb-2 ${selected ? 'border border-blue-400' : ''}`}>
        <View className="flex-row items-center mb-2">
          <View className="flex-1">
            <Text className="text-white text-sm font-semibold">{league.name}</Text>
            <Text className="text-gray-500 text-xs mt-px">
              Budget: ${remaining} / ${totalBudget} remaining
            </Text>
          </View>
          <TouchableOpacity
            className={`bg-blue-600 rounded-lg px-3.5 py-1.5 ${submitting ? 'opacity-50' : ''}`}
            onPress={onSubmit}
            disabled={submitting}
          >
            <Text className="text-white text-[13px] font-semibold">{submitting ? '...' : 'Claim'}</Text>
          </TouchableOpacity>
        </View>

        {/* Budget bar */}
        <View className="bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
          <View
            className="bg-blue-500 h-full rounded-full"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </View>

        {/* Per-league bid override */}
        <TextInput
          value={bidValue}
          onChangeText={onBidChange}
          placeholder="Bid override"
          placeholderTextColor="#6B7280"
          keyboardType="number-pad"
          className="bg-gray-900 rounded-lg px-3 py-2 text-gray-100 text-sm border border-gray-700"
        />
      </View>
    </TouchableOpacity>
  )
}

/* ------------------------------------------------------------------ */
/*  WaiversScreen                                                      */
/* ------------------------------------------------------------------ */

export default function WaiversScreen() {
  const { session } = useAuth()
  const { leagues, playerShares, loading: leaguesLoading } = useLeagueCache()
  const { allplayers } = useAllPlayers()
  const { ktc } = useKtc()

  // Player selection
  const [addPlayer, setAddPlayer] = useState<string | null>(null)
  const [dropPlayer, setDropPlayer] = useState<string | null>(null)
  const [showAddSearch, setShowAddSearch] = useState(false)
  const [showDropSearch, setShowDropSearch] = useState(false)

  // Bid controls
  const [bidMode, setBidMode] = useState<'amount' | 'percent'>('amount')
  const [masterBid, setMasterBid] = useState('')
  const [perLeagueBids, setPerLeagueBids] = useState<Record<string, string>>({})

  // Submission
  const [submittingKey, setSubmittingKey] = useState<string | null>(null)
  const [selectedLeagues, setSelectedLeagues] = useState<Set<string>>(new Set())
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)

  const allPlayerIds = useMemo(() => Object.keys(allplayers), [allplayers])

  const ownedPlayers = useMemo(
    () => Object.keys(playerShares).filter((id) => playerShares[id].owned.length > 0),
    [playerShares],
  )

  // Leagues where user does NOT own the add player AND owns the drop player (if set)
  const matchingLeagues = useMemo(() => {
    if (!leagues || !addPlayer) return []
    return Object.values(leagues).filter((league) => {
      const roster = league.user_roster
      // Must not already own the add player
      if (roster.players.includes(addPlayer)) return false
      // Must own the drop player if specified
      if (dropPlayer && !roster.players.includes(dropPlayer)) return false
      return true
    })
  }, [leagues, addPlayer, dropPlayer])

  const computeBid = useCallback((league: LeagueDetailed): number => {
    const override = perLeagueBids[league.league_id]
    if (override && override.trim() !== '') return parseInt(override, 10) || 0

    const raw = parseInt(masterBid, 10) || 0
    if (bidMode === 'percent') {
      const totalBudget = league.settings.waiver_budget ?? 100
      const used = league.user_roster.waiver_budget_used ?? 0
      const remaining = totalBudget - used
      return Math.round((raw / 100) * remaining)
    }
    return raw
  }, [masterBid, bidMode, perLeagueBids])

  const submitClaim = useCallback(async (league: LeagueDetailed) => {
    if (!addPlayer) return
    const key = league.league_id
    setSubmittingKey(key)
    try {
      const rosterId = league.user_roster.roster_id
      const bidAmount = computeBid(league)

      await mobileDataClient.graphql('submitWaiverClaim', {
        league_id: league.league_id,
        k_adds: [addPlayer],
        v_adds: [rosterId],
        k_drops: dropPlayer ? [dropPlayer] : [],
        v_drops: dropPlayer ? [rosterId] : [],
        k_settings: ['waiver_bid'],
        v_settings: [bidAmount],
      })

      Alert.alert('Submitted', `Waiver claim submitted in ${league.name}`)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e))
    } finally {
      setSubmittingKey(null)
    }
  }, [addPlayer, dropPlayer, computeBid])

  const toggleSelected = useCallback((key: string) => {
    setSelectedLeagues((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  const batchSubmit = useCallback(async () => {
    const toSubmit = matchingLeagues.filter((l) => selectedLeagues.has(l.league_id))
    if (toSubmit.length === 0) return
    setBatchSubmitting(true)
    setBatchProgress(0)
    for (let i = 0; i < toSubmit.length; i++) {
      try { await submitClaim(toSubmit[i]) } catch {}
      setBatchProgress(i + 1)
      if (i < toSubmit.length - 1) await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000))
    }
    setBatchSubmitting(false)
    setSelectedLeagues(new Set())
    Alert.alert('Done', `Submitted ${toSubmit.length} waiver claims`)
  }, [matchingLeagues, selectedLeagues, submitClaim])

  if (leaguesLoading) {
    return <View className="flex-1 bg-gray-900 items-center justify-center"><ActivityIndicator size="large" color="#60A5FA" /></View>
  }

  return (
    <ScrollView className="flex-1 bg-gray-900" contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      {/* Player Selection */}
      <View className="bg-gray-800 rounded-xl p-3.5 mb-3">
        <Text className="text-gray-400 text-[13px] font-bold uppercase tracking-wide mb-2">Player Selection</Text>
        <View className="flex-row gap-2 mb-2">
          <TouchableOpacity
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 items-center"
            onPress={() => setShowAddSearch(true)}
          >
            <Text className="text-gray-500 text-[13px] font-medium">+ Pick Up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 items-center"
            onPress={() => setShowDropSearch(true)}
          >
            <Text className="text-gray-500 text-[13px] font-medium">- Drop</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row flex-wrap gap-1">
          {addPlayer && (
            <Chip
              label={allplayers[addPlayer]?.full_name || addPlayer}
              chipColor="#4ADE80"
              onRemove={() => setAddPlayer(null)}
            />
          )}
          {dropPlayer && (
            <Chip
              label={allplayers[dropPlayer]?.full_name || dropPlayer}
              chipColor="#F87171"
              onRemove={() => setDropPlayer(null)}
            />
          )}
        </View>
      </View>

      {/* Master Bid Controls */}
      <View className="bg-gray-800 rounded-xl p-3.5 mb-3">
        <Text className="text-gray-400 text-[13px] font-bold uppercase tracking-wide mb-2">Bid</Text>
        <View className="flex-row gap-2 mb-2">
          <TouchableOpacity
            className={`flex-1 rounded-lg p-2.5 items-center border ${bidMode === 'amount' ? 'bg-blue-600/20 border-blue-400' : 'bg-gray-900 border-gray-700'}`}
            onPress={() => setBidMode('amount')}
          >
            <Text className={`text-[13px] font-medium ${bidMode === 'amount' ? 'text-blue-400' : 'text-gray-500'}`}>$ Amount</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 rounded-lg p-2.5 items-center border ${bidMode === 'percent' ? 'bg-blue-600/20 border-blue-400' : 'bg-gray-900 border-gray-700'}`}
            onPress={() => setBidMode('percent')}
          >
            <Text className={`text-[13px] font-medium ${bidMode === 'percent' ? 'text-blue-400' : 'text-gray-500'}`}>% Remaining</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          value={masterBid}
          onChangeText={setMasterBid}
          placeholder={bidMode === 'amount' ? 'Bid amount (e.g. 15)' : 'Percent of remaining (e.g. 25)'}
          placeholderTextColor="#6B7280"
          keyboardType="number-pad"
          className="bg-gray-900 rounded-lg px-3 py-2.5 text-gray-100 text-sm border border-gray-700"
        />
      </View>

      {/* League Cards */}
      {matchingLeagues.length > 0 ? (
        <View>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-400 text-sm font-semibold mt-1">
              {matchingLeagues.length} {matchingLeagues.length === 1 ? 'league' : 'leagues'}
              {selectedLeagues.size > 0 ? ` \u00B7 ${selectedLeagues.size} selected` : ''}
            </Text>
            {selectedLeagues.size > 0 && (
              <TouchableOpacity
                className={`bg-blue-600 rounded-lg px-3.5 py-1.5 ${batchSubmitting ? 'opacity-50' : ''}`}
                onPress={batchSubmit}
                disabled={batchSubmitting}
              >
                <Text className="text-white text-[13px] font-semibold">
                  {batchSubmitting ? `${batchProgress}/${selectedLeagues.size}...` : `Submit ${selectedLeagues.size}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {matchingLeagues.map((league) => (
            <WaiverLeagueCard
              key={league.league_id}
              league={league}
              bidValue={perLeagueBids[league.league_id] ?? ''}
              onBidChange={(v) => setPerLeagueBids((prev) => ({ ...prev, [league.league_id]: v }))}
              onSubmit={() =>
                Alert.alert(
                  'Submit Claim?',
                  `Bid $${computeBid(league)} in ${league.name}?`,
                  [{ text: 'Cancel', style: 'cancel' }, { text: 'Submit', onPress: () => submitClaim(league) }],
                )
              }
              submitting={submittingKey === league.league_id}
              selected={selectedLeagues.has(league.league_id)}
              onLongPress={() => toggleSelected(league.league_id)}
            />
          ))}
        </View>
      ) : addPlayer ? (
        <Text className="text-gray-500 text-[13px] text-center mt-6">No matching leagues for this player.</Text>
      ) : (
        <Text className="text-gray-500 text-[13px] text-center mt-6">Select a player to pick up to find eligible leagues.</Text>
      )}

      {/* Modals */}
      <PlayerSearchModal
        visible={showAddSearch}
        playerIds={allPlayerIds}
        allplayers={allplayers}
        ktc={ktc}
        selected={addPlayer ? [addPlayer] : []}
        onSelect={(id) => { setAddPlayer(id); setShowAddSearch(false) }}
        onClose={() => setShowAddSearch(false)}
        title="Pick Up Player"
      />
      <PlayerSearchModal
        visible={showDropSearch}
        playerIds={ownedPlayers}
        allplayers={allplayers}
        ktc={ktc}
        selected={dropPlayer ? [dropPlayer] : []}
        onSelect={(id) => { setDropPlayer(id); setShowDropSearch(false) }}
        onClose={() => setShowDropSearch(false)}
        title="Drop Player"
      />
    </ScrollView>
  )
}
