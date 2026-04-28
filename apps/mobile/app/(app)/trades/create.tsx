import { useState, useMemo, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, StyleSheet, ScrollView, Modal,
} from 'react-native'
import type { LeagueDetailed, Roster, Allplayer, DraftpickDetailed } from '@autogm/shared'
import { getPickId } from '@autogm/shared'
import { useAuth } from '@autogm/shared/react'
import { useLeagueCache } from '../../../src/league-cache'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { useKtc } from '../../../src/hooks/use-ktc'
import { mobileDataClient } from '../../../src/data-client'
import { colors } from '../../../src/theme'

type Step = 'league' | 'partner' | 'assets' | 'review'

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
          <TouchableOpacity onPress={onClose}>
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

function PickSelector({
  picks,
  selected,
  onToggle,
  ktc,
}: {
  picks: DraftpickDetailed[]
  selected: string[]
  onToggle: (id: string) => void
  ktc: Record<string, number>
}) {
  if (picks.length === 0) return <Text style={s.dimText}>No picks available</Text>

  return (
    <View style={{ gap: 4 }}>
      {picks.map((pick) => {
        const id = getPickId(pick)
        const isSelected = selected.includes(id)
        const suffix = pick.round === 1 ? 'st' : pick.round === 2 ? 'nd' : pick.round === 3 ? 'rd' : 'th'
        const orderStr = pick.order ? `.${String(pick.order).padStart(2, '0')}` : ''
        const label = `${pick.season} ${pick.round}${suffix}${orderStr}`
        const ktcName = `${pick.season} Mid ${pick.round}${suffix}`
        const value = ktc[ktcName] ?? 0
        return (
          <TouchableOpacity
            key={id}
            onPress={() => onToggle(id)}
            style={[s.pickRow, isSelected && s.pickRowSelected]}
          >
            <Text style={[s.pickLabel, isSelected && { color: colors.white }]}>{label}</Text>
            {value > 0 && <Text style={s.pickKtc}>{value}</Text>}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function AssetChip({
  label,
  value,
  color: chipColor,
  onRemove,
}: {
  label: string
  value?: number
  color: string
  onRemove: () => void
}) {
  return (
    <View style={[s.chip, { borderColor: chipColor + '60', backgroundColor: chipColor + '15' }]}>
      <Text style={[s.chipText, { color: chipColor }]}>{label}</Text>
      {value != null && value > 0 && <Text style={[s.chipValue, { color: chipColor + 'AA' }]}>{value}</Text>}
      <TouchableOpacity onPress={onRemove}>
        <Text style={{ color: chipColor, fontSize: 16, marginLeft: 4 }}>x</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function CreateTradeScreen() {
  const { session } = useAuth()
  const { leagues, loading: leaguesLoading } = useLeagueCache()
  const { allplayers } = useAllPlayers()
  const { ktc } = useKtc()

  const [step, setStep] = useState<Step>('league')
  const [selectedLeague, setSelectedLeague] = useState<LeagueDetailed | null>(null)
  const [selectedPartner, setSelectedPartner] = useState<Roster | null>(null)
  const [playersToGive, setPlayersToGive] = useState<string[]>([])
  const [playersToReceive, setPlayersToReceive] = useState<string[]>([])
  const [picksToGive, setPicksToGive] = useState<string[]>([])
  const [picksToReceive, setPicksToReceive] = useState<string[]>([])
  const [showGiveSearch, setShowGiveSearch] = useState(false)
  const [showReceiveSearch, setShowReceiveSearch] = useState(false)
  const [sending, setSending] = useState(false)

  const leagueList = useMemo(() => (leagues ? Object.values(leagues) : []), [leagues])

  const reset = useCallback(() => {
    setStep('league')
    setSelectedLeague(null)
    setSelectedPartner(null)
    setPlayersToGive([])
    setPlayersToReceive([])
    setPicksToGive([])
    setPicksToReceive([])
  }, [])

  const giveTotal = useMemo(
    () => playersToGive.reduce((s, id) => s + (ktc[id] ?? 0), 0) +
          picksToGive.reduce((s, id) => s + 0, 0), // picks value approximation
    [playersToGive, picksToGive, ktc],
  )
  const receiveTotal = useMemo(
    () => playersToReceive.reduce((s, id) => s + (ktc[id] ?? 0), 0),
    [playersToReceive, ktc],
  )

  const sendTrade = useCallback(async () => {
    if (!selectedLeague || !selectedPartner) return
    const userRoster = selectedLeague.user_roster
    const partner = selectedPartner

    setSending(true)
    try {
      await mobileDataClient.graphql('proposeTrade', {
        league_id: selectedLeague.league_id,
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
      Alert.alert('Trade Sent', 'Your trade proposal has been sent.', [
        { text: 'OK', onPress: reset },
      ])
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }, [selectedLeague, selectedPartner, playersToGive, playersToReceive, picksToGive, picksToReceive, reset])

  if (leaguesLoading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.blueLight} /></View>
  }

  // Step 1: Select league
  if (step === 'league') {
    return (
      <View style={s.container}>
        <Text style={s.stepTitle}>Select a League</Text>
        <FlatList
          data={leagueList}
          keyExtractor={(l) => l.league_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.selectCard}
              onPress={() => { setSelectedLeague(item); setStep('partner') }}
            >
              <Text style={s.selectName}>{item.name}</Text>
              <Text style={s.selectDetail}>{item.rosters.length} teams</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ padding: 16 }}
        />
      </View>
    )
  }

  // Step 2: Select partner
  if (step === 'partner' && selectedLeague) {
    const opponents = selectedLeague.rosters.filter(
      (r) => r.roster_id !== selectedLeague.user_roster.roster_id,
    )
    return (
      <View style={s.container}>
        <TouchableOpacity onPress={() => setStep('league')} style={s.backBtn}>
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.stepTitle}>Trade Partner in {selectedLeague.name}</Text>
        <FlatList
          data={opponents}
          keyExtractor={(r) => String(r.roster_id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.selectCard}
              onPress={() => { setSelectedPartner(item); setStep('assets') }}
            >
              <Text style={s.selectName}>{item.username}</Text>
              <Text style={s.selectDetail}>{item.wins}-{item.losses}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ padding: 16 }}
        />
      </View>
    )
  }

  // Step 3: Select assets
  if (step === 'assets' && selectedLeague && selectedPartner) {
    const userRoster = selectedLeague.user_roster
    const hasAssets = playersToGive.length + playersToReceive.length + picksToGive.length + picksToReceive.length > 0

    return (
      <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={() => { setStep('partner'); setPlayersToGive([]); setPlayersToReceive([]); setPicksToGive([]); setPicksToReceive([]) }} style={s.backBtn}>
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={s.stepTitle}>{selectedLeague.name}</Text>
        <Text style={s.dimText}>Trading with {selectedPartner.username}</Text>

        {/* You give */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.red }]}>You Give</Text>
            <Text style={s.sectionTotal}>{giveTotal.toLocaleString()} KTC</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowGiveSearch(true)}>
            <Text style={s.addBtnText}>+ Add Player</Text>
          </TouchableOpacity>
          {playersToGive.map((id) => (
            <AssetChip
              key={id}
              label={allplayers[id]?.full_name || id}
              value={ktc[id]}
              color={colors.red}
              onRemove={() => setPlayersToGive((p) => p.filter((x) => x !== id))}
            />
          ))}
          <Text style={[s.dimText, { marginTop: 8 }]}>Picks</Text>
          <PickSelector
            picks={userRoster.draftpicks}
            selected={picksToGive}
            onToggle={(id) => setPicksToGive((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])}
            ktc={ktc}
          />
        </View>

        {/* You receive */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.green }]}>You Receive</Text>
            <Text style={s.sectionTotal}>{receiveTotal.toLocaleString()} KTC</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowReceiveSearch(true)}>
            <Text style={s.addBtnText}>+ Add Player</Text>
          </TouchableOpacity>
          {playersToReceive.map((id) => (
            <AssetChip
              key={id}
              label={allplayers[id]?.full_name || id}
              value={ktc[id]}
              color={colors.green}
              onRemove={() => setPlayersToReceive((p) => p.filter((x) => x !== id))}
            />
          ))}
          <Text style={[s.dimText, { marginTop: 8 }]}>Picks</Text>
          <PickSelector
            picks={selectedPartner.draftpicks}
            selected={picksToReceive}
            onToggle={(id) => setPicksToReceive((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])}
            ktc={ktc}
          />
        </View>

        {hasAssets && (
          <TouchableOpacity style={s.reviewBtn} onPress={() => setStep('review')}>
            <Text style={s.reviewBtnText}>Review Trade</Text>
          </TouchableOpacity>
        )}

        <PlayerSearchModal
          visible={showGiveSearch}
          playerIds={userRoster.players}
          allplayers={allplayers}
          ktc={ktc}
          selected={[...playersToGive, ...playersToReceive]}
          onSelect={(id) => setPlayersToGive((p) => [...p, id])}
          onClose={() => setShowGiveSearch(false)}
          title="Your Players"
        />
        <PlayerSearchModal
          visible={showReceiveSearch}
          playerIds={selectedPartner.players}
          allplayers={allplayers}
          ktc={ktc}
          selected={[...playersToGive, ...playersToReceive]}
          onSelect={(id) => setPlayersToReceive((p) => [...p, id])}
          onClose={() => setShowReceiveSearch(false)}
          title={`${selectedPartner.username}'s Players`}
        />
      </ScrollView>
    )
  }

  // Step 4: Review and send
  if (step === 'review' && selectedLeague && selectedPartner) {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={() => setStep('assets')} style={s.backBtn}>
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={s.stepTitle}>Review Trade</Text>
        <Text style={s.dimText}>{selectedLeague.name} - with {selectedPartner.username}</Text>

        <View style={[s.section, { borderLeftWidth: 3, borderLeftColor: colors.red }]}>
          <Text style={[s.sectionTitle, { color: colors.red }]}>You Give ({giveTotal.toLocaleString()})</Text>
          {playersToGive.map((id) => (
            <Text key={id} style={s.reviewItem}>- {allplayers[id]?.full_name || id} {ktc[id] ? `(${ktc[id]})` : ''}</Text>
          ))}
          {picksToGive.map((id) => <Text key={id} style={s.reviewItem}>- {id}</Text>)}
        </View>

        <View style={[s.section, { borderLeftWidth: 3, borderLeftColor: colors.green }]}>
          <Text style={[s.sectionTitle, { color: colors.green }]}>You Receive ({receiveTotal.toLocaleString()})</Text>
          {playersToReceive.map((id) => (
            <Text key={id} style={s.reviewItem}>+ {allplayers[id]?.full_name || id} {ktc[id] ? `(${ktc[id]})` : ''}</Text>
          ))}
          {picksToReceive.map((id) => <Text key={id} style={s.reviewItem}>+ {id}</Text>)}
        </View>

        <TouchableOpacity
          style={[s.sendBtn, sending && { opacity: 0.5 }]}
          onPress={() => Alert.alert('Send Trade?', `Send this trade to ${selectedPartner.username}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send', onPress: sendTrade },
          ])}
          disabled={sending}
        >
          <Text style={s.sendBtnText}>{sending ? 'Sending...' : 'Send Trade Proposal'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={reset}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  return null
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  dimText: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  backBtn: { marginBottom: 12 },
  backText: { color: colors.blueLight, fontSize: 14 },
  selectCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectName: { color: colors.white, fontSize: 15, fontWeight: '600' },
  selectDetail: { color: colors.textMuted, fontSize: 13 },
  section: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionTotal: { color: colors.textMuted, fontSize: 12 },
  addBtn: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 8 },
  addBtnText: { color: colors.textMuted, fontSize: 13 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 4 },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipValue: { fontSize: 11, marginLeft: 6 },
  pickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4, borderWidth: 1, borderColor: colors.border },
  pickRowSelected: { backgroundColor: colors.blue + '30', borderColor: colors.blueLight },
  pickLabel: { color: colors.textSecondary, fontSize: 13 },
  pickKtc: { color: colors.textMuted, fontSize: 11 },
  reviewItem: { color: colors.text, fontSize: 14, marginTop: 4 },
  reviewBtn: { backgroundColor: colors.blue, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  reviewBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  sendBtn: { backgroundColor: colors.green + '30', borderWidth: 1, borderColor: colors.green + '60', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  sendBtnText: { color: colors.green, fontSize: 15, fontWeight: '700' },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: colors.textMuted, fontSize: 14 },
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
