import { useState, useMemo, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, StyleSheet, ScrollView, Modal,
} from 'react-native'
import type { LeagueDetailed, Roster, Allplayer } from '@autogm/shared'
import { getPickId } from '@autogm/shared'
import { useAuth } from '@autogm/shared/react'
import { useLeagueCache } from '../../../src/league-cache'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { useKtc } from '../../../src/hooks/use-ktc'
import { mobileDataClient } from '../../../src/data-client'
import { colors } from '../../../src/theme'

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
      <View style={s.modalContainer}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={() => { onClose(); setQuery('') }}>
            <Text style={{ color: colors.blueLight, fontSize: 15 }}>Done</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search players..."
          placeholderTextColor={colors.textMuted}
          style={s.searchInput}
          autoFocus
        />
        <FlatList
          data={filtered}
          keyExtractor={(id) => id}
          renderItem={({ item: id }) => {
            const p = allplayers[id]
            const value = ktc[id] ?? 0
            return (
              <TouchableOpacity style={s.searchRow} onPress={() => { onSelect(id); setQuery('') }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.searchName}>{p?.full_name || id}</Text>
                  <Text style={s.searchDetail}>{p?.position ?? '?'} - {p?.team ?? 'FA'}</Text>
                </View>
                {value > 0 && <Text style={s.searchKtc}>{value}</Text>}
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
    <View style={[s.chip, { borderColor: chipColor + '60', backgroundColor: chipColor + '15' }]}>
      <Text style={[s.chipText, { color: chipColor }]}>{label}</Text>
      {value != null && value > 0 && <Text style={[s.chipValue, { color: chipColor + 'AA' }]}>{value}</Text>}
      <TouchableOpacity onPress={onRemove} hitSlop={8}>
        <Text style={{ color: chipColor, fontSize: 16, marginLeft: 4 }}>x</Text>
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
    <View style={s.matchCard}>
      <View style={s.matchHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.matchLeague}>{league.name}</Text>
          <Text style={s.matchPartner}>with {partner.username} ({partner.wins}-{partner.losses})</Text>
        </View>
        <TouchableOpacity
          style={[s.sendBtn, sending && { opacity: 0.5 }]}
          onPress={onSend}
          disabled={sending}
        >
          <Text style={s.sendBtnText}>{sending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
      <View style={s.matchSummary}>
        <View style={{ flex: 1 }}>
          <Text style={[s.matchLabel, { color: colors.red }]}>Give ({giveTotal.toLocaleString()})</Text>
          {playersToGive.map((id) => (
            <Text key={id} style={s.matchItem} numberOfLines={1}>{allplayers[id]?.full_name || id}</Text>
          ))}
          {picksToGive.map((id) => <Text key={id} style={s.matchItem}>{id}</Text>)}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.matchLabel, { color: colors.green }]}>Get ({receiveTotal.toLocaleString()})</Text>
          {playersToReceive.map((id) => (
            <Text key={id} style={s.matchItem} numberOfLines={1}>{allplayers[id]?.full_name || id}</Text>
          ))}
          {picksToReceive.map((id) => <Text key={id} style={s.matchItem}>{id}</Text>)}
        </View>
      </View>
    </View>
  )
}

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

      return league.rosters
        .filter((r) => r.roster_id !== userRoster.roster_id)
        .filter((r) =>
          playersToReceive.every((pid) => r.players.includes(pid)) &&
          picksToReceive.every((pid) => r.draftpicks.some((d) => getPickId(d) === pid)),
        )
        .map((partner) => ({ league, partner }))
    })
  }, [leagues, playersToGive, playersToReceive, picksToGive, picksToReceive])

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
      })
      Alert.alert('Sent', `Trade sent to ${partner.username} in ${league.name}`)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e))
    } finally {
      setSendingKey(null)
    }
  }, [playersToGive, playersToReceive, picksToGive, picksToReceive])

  const giveTotal = playersToGive.reduce((s, id) => s + (ktc[id] ?? 0), 0)
  const receiveTotal = playersToReceive.reduce((s, id) => s + (ktc[id] ?? 0), 0)

  if (leaguesLoading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.blueLight} /></View>
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      {/* You Give */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.red }]}>You Give</Text>
          {giveTotal > 0 && <Text style={s.sectionTotal}>{giveTotal.toLocaleString()}</Text>}
        </View>
        <View style={s.btnRow}>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowGiveSearch(true)}>
            <Text style={s.addBtnText}>+ Player</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowGivePicks(true)}>
            <Text style={s.addBtnText}>+ Pick</Text>
          </TouchableOpacity>
        </View>
        {playersToGive.length > 0 && (
          <View style={s.chipWrap}>
            {playersToGive.map((id) => (
              <Chip key={id} label={allplayers[id]?.full_name || id} value={ktc[id]} chipColor={colors.red}
                onRemove={() => setPlayersToGive((p) => p.filter((x) => x !== id))} />
            ))}
          </View>
        )}
        {picksToGive.map((id) => (
          <Chip key={id} label={id} chipColor={colors.red}
            onRemove={() => setPicksToGive((p) => p.filter((x) => x !== id))} />
        ))}
      </View>

      {/* You Receive */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.green }]}>You Receive</Text>
          {receiveTotal > 0 && <Text style={s.sectionTotal}>{receiveTotal.toLocaleString()}</Text>}
        </View>
        <View style={s.btnRow}>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowReceiveSearch(true)}>
            <Text style={s.addBtnText}>+ Player</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowReceivePicks(true)}>
            <Text style={s.addBtnText}>+ Pick</Text>
          </TouchableOpacity>
        </View>
        {playersToReceive.length > 0 && (
          <View style={s.chipWrap}>
            {playersToReceive.map((id) => (
              <Chip key={id} label={allplayers[id]?.full_name || id} value={ktc[id]} chipColor={colors.green}
                onRemove={() => setPlayersToReceive((p) => p.filter((x) => x !== id))} />
            ))}
          </View>
        )}
        {picksToReceive.map((id) => (
          <Chip key={id} label={id} chipColor={colors.green}
            onRemove={() => setPicksToReceive((p) => p.filter((x) => x !== id))} />
        ))}
      </View>

      {/* Potential Trades */}
      {filteredMatches.length > 0 ? (
        <View>
          <Text style={s.matchesTitle}>
            {filteredMatches.length} potential {filteredMatches.length === 1 ? 'trade' : 'trades'}
          </Text>
          {filteredMatches.map(({ league, partner }) => (
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
          ))}
        </View>
      ) : (playersToGive.length + playersToReceive.length + picksToGive.length + picksToReceive.length > 0) ? (
        <Text style={s.noMatches}>No matching leagues for these players/picks.</Text>
      ) : (
        <Text style={s.noMatches}>Select players or picks above to find trades.</Text>
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
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  section: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sectionTotal: { color: colors.textMuted, fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  addBtn: { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, alignItems: 'center' },
  addBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 4 },
  chipText: { fontSize: 12, fontWeight: '500' },
  chipValue: { fontSize: 10, marginLeft: 4 },
  matchesTitle: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  noMatches: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 24 },
  matchCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  matchHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  matchLeague: { color: colors.white, fontSize: 14, fontWeight: '600' },
  matchPartner: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  matchSummary: { flexDirection: 'row', gap: 12 },
  matchLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  matchItem: { color: colors.text, fontSize: 12, marginBottom: 1 },
  sendBtn: { backgroundColor: colors.blue, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  sendBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  searchInput: { backgroundColor: colors.card, borderRadius: 8, margin: 16, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
  searchName: { color: colors.text, fontSize: 14, fontWeight: '500' },
  searchDetail: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  searchKtc: { color: colors.blueLight, fontSize: 13, fontWeight: '600' },
})
