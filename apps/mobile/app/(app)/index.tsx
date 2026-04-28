import { useState, useMemo, useEffect } from 'react'
import { View, Text, FlatList, ActivityIndicator, Image, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native'
import type { LeagueDetailed, Roster, Allplayer } from '@autogm/shared'
import { useLeagueCache } from '../../src/league-cache'
import { useKtc } from '../../src/hooks/use-ktc'
import { useAdp } from '../../src/hooks/use-adp'
import { useAllPlayers } from '../../src/hooks/use-allplayers'
import { useAuth } from '@autogm/shared/react'
import { type ValueType, buildValueLookup, formatValue, getPickKtcName } from '../../src/utils/value-lookup'
import { mobileDataClient } from '../../src/data-client'
import { colors } from '../../src/theme'
import type { Message, MessagesResult, CreateMessageResult } from '@autogm/shared'
import { useCallback, useRef } from 'react'

type LeaguesTab = 'ranks' | 'chats'
type PositionFilter = 'ALL' | 'PLAYERS' | 'QB' | 'RB' | 'WR' | 'TE' | 'PICKS'

const RANK_CATEGORIES: { label: string; filter: PositionFilter }[] = [
  { label: 'Overall', filter: 'ALL' },
  { label: 'Players', filter: 'PLAYERS' },
  { label: 'QB', filter: 'QB' },
  { label: 'RB', filter: 'RB' },
  { label: 'WR', filter: 'WR' },
  { label: 'TE', filter: 'TE' },
  { label: 'Picks', filter: 'PICKS' },
]

function computeRosterValue(
  roster: Roster, filter: PositionFilter, values: Record<string, number>, allplayers: Record<string, Allplayer>,
): number {
  const vals: number[] = []
  if (filter !== 'PICKS') {
    for (const pid of roster.players ?? []) {
      const player = allplayers[pid]
      if (!player) continue
      if (filter !== 'ALL' && filter !== 'PLAYERS' && player.position !== filter) continue
      vals.push(values[pid] ?? 0)
    }
  }
  if (filter === 'ALL' || filter === 'PICKS') {
    for (const pick of roster.draftpicks ?? []) {
      vals.push(values[getPickKtcName(pick.season, pick.round, pick.order)] ?? 0)
    }
  }
  return vals.reduce((a, b) => a + b, 0)
}

function rankColor(rank: number | null, total: number): string {
  if (rank === 1) return colors.orange
  if (rank != null && rank <= 3) return colors.green
  if (rank != null && rank >= total - 2) return colors.red
  return colors.text
}

function getRank(league: LeagueDetailed, rosterId: number, filter: PositionFilter, values: Record<string, number>, allplayers: Record<string, Allplayer>): number {
  const totals = league.rosters.map((r) => ({ rid: r.roster_id, total: computeRosterValue(r, filter, values, allplayers) }))
  totals.sort((a, b) => b.total - a.total)
  return totals.findIndex((t) => t.rid === rosterId) + 1
}

// ─── Ranks Tab ────────────────────────────────────────────

function LeagueRankCard({
  league, values, allplayers, valueType,
}: {
  league: LeagueDetailed; values: Record<string, number>; allplayers: Record<string, Allplayer>; valueType: ValueType
}) {
  const [expanded, setExpanded] = useState(false)
  const [expandedFilter, setExpandedFilter] = useState<PositionFilter>('ALL')
  const total = league.rosters.length

  return (
    <View style={s.card}>
      <TouchableOpacity onPress={() => setExpanded((p) => !p)} style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.leagueName}>{league.name}</Text>
          <Text style={s.subtext}>{total} teams</Text>
        </View>
      </TouchableOpacity>

      {/* Multi-rank grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingBottom: 12 }}>
        {RANK_CATEGORIES.map(({ label, filter }) => {
          const rank = getRank(league, league.user_roster.roster_id, filter, values, allplayers)
          const value = computeRosterValue(league.user_roster, filter, values, allplayers)
          return (
            <View key={filter} style={s.rankBox}>
              <Text style={s.rankLabel}>{label}</Text>
              <Text style={[s.rankNum, { color: rankColor(rank, total) }]}>#{rank}</Text>
              <Text style={s.rankVal}>{formatValue(value, valueType)}</Text>
            </View>
          )
        })}
      </ScrollView>

      {/* Expanded: full team table for selected filter */}
      {expanded && (
        <View style={s.expandedSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingHorizontal: 12, paddingBottom: 8 }}>
            {RANK_CATEGORIES.map(({ label, filter }) => (
              <TouchableOpacity key={filter} onPress={() => setExpandedFilter(filter)}
                style={[s.miniFilterBtn, expandedFilter === filter && s.miniFilterBtnActive]}>
                <Text style={[s.miniFilterText, expandedFilter === filter && s.miniFilterTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {league.rosters
            .map((r) => ({ roster: r, value: computeRosterValue(r, expandedFilter, values, allplayers) }))
            .sort((a, b) => b.value - a.value)
            .map((entry, i) => {
              const isUser = entry.roster.roster_id === league.user_roster.roster_id
              return (
                <View key={entry.roster.roster_id} style={[s.rankRow, isUser && s.rankRowUser]}>
                  <Text style={[s.rankRowNum, { color: rankColor(i + 1, total) }]}>#{i + 1}</Text>
                  <Text style={[s.rankRowName, isUser && { color: colors.blueLight }]} numberOfLines={1}>{entry.roster.username}</Text>
                  <Text style={s.rankRowVal}>{formatValue(entry.value, valueType)}</Text>
                </View>
              )
            })}
        </View>
      )}
    </View>
  )
}

function RanksView({ leagues, allplayers, ktc }: {
  leagues: LeagueDetailed[]; allplayers: Record<string, Allplayer>; ktc: Record<string, number>
}) {
  const [valueType, setValueType] = useState<ValueType>('ktc')
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const defaultStart = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) }, [])
  const isAdp = valueType === 'adp' || valueType === 'auction'
  const { data: adpRows, stats, loading: adpLoading } = useAdp(
    { startDate: defaultStart, endDate: today, minDrafts: 2 }, isAdp,
  )
  const valueLookup = useMemo(() => buildValueLookup(valueType, ktc, adpRows), [valueType, ktc, adpRows])

  const valueTypes: ValueType[] = ['ktc', 'adp', 'auction']

  return (
    <View style={{ flex: 1 }}>
      {/* Value type toggle */}
      <View style={s.controlBar}>
        <View style={s.segmented}>
          {valueTypes.map((v) => (
            <TouchableOpacity key={v} onPress={() => setValueType(v)} style={[s.segBtn, valueType === v && s.segBtnActive]}>
              <Text style={[s.segText, valueType === v && s.segTextActive]}>{v.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {isAdp && stats && !adpLoading && (
          <Text style={s.statsText}>{stats.n_drafts.toLocaleString()} drafts</Text>
        )}
        {adpLoading && <ActivityIndicator size="small" color={colors.blueLight} style={{ marginLeft: 8 }} />}
      </View>

      <FlatList
        data={leagues}
        keyExtractor={(l) => l.league_id}
        renderItem={({ item }) => (
          <LeagueRankCard league={item} values={valueLookup} allplayers={allplayers} valueType={valueType} />
        )}
        contentContainerStyle={{ padding: 12 }}
      />
    </View>
  )
}

// ─── Chats Tab ────────────────────────────────────────────

type SortMode = 'original' | 'alpha' | 'recent'

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function ChatCard({ league, userId, onLastMessage }: {
  league: LeagueDetailed; userId: string; onLastMessage?: (id: string, t: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const draftRef = useRef(draft); draftRef.current = draft
  const flatListRef = useRef<FlatList>(null)

  const fetchMsgs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const r = await mobileDataClient.graphql('messages', { parent_id: league.league_id })
      const msgs = (r as MessagesResult).messages ?? []
      setMessages(msgs)
      if (msgs.length > 0 && onLastMessage) onLastMessage(league.league_id, Math.max(...msgs.map((m) => m.created)))
    } catch {} finally { if (!silent) setLoading(false) }
  }, [league.league_id, onLastMessage])

  useEffect(() => { fetchMsgs(true) }, []) // eslint-disable-line
  useEffect(() => { if (expanded) fetchMsgs() }, [expanded]) // eslint-disable-line

  const sendMsg = useCallback(async () => {
    const text = draftRef.current.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await mobileDataClient.graphql('createLeagueMessage' as any, { parent_id: league.league_id, text } as any)
      setDraft(''); await fetchMsgs()
    } catch {} finally { setSending(false) }
  }, [league.league_id, sending, fetchMsgs])

  const sorted = useMemo(() => [...messages].sort((a, b) => a.created - b.created), [messages])
  const lastMsg = sorted.length > 0 ? sorted[sorted.length - 1] : null

  return (
    <View style={s.card}>
      <TouchableOpacity onPress={() => setExpanded((p) => !p)} style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.leagueName}>{league.name}</Text>
          {!expanded && lastMsg ? (
            <Text style={s.subtext} numberOfLines={1}>{lastMsg.author_display_name}: {lastMsg.text || '...'}</Text>
          ) : (
            <Text style={s.subtext}>{league.rosters.length} teams</Text>
          )}
        </View>
        {!expanded && lastMsg && <Text style={{ color: colors.textDim, fontSize: 10 }}>{formatTime(lastMsg.created)}</Text>}
      </TouchableOpacity>

      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ maxHeight: 260 }}>
            {loading && messages.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator size="small" color={colors.blueLight} /></View>
            ) : (
              <FlatList ref={flatListRef} data={sorted} keyExtractor={(m) => m.message_id}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => {
                  const isMe = item.author_id === userId
                  return (
                    <View style={[{ marginBottom: 4 }, isMe ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                      <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>{item.author_display_name}</Text>
                        {item.text ? <Text style={{ color: colors.text, fontSize: 13 }}>{item.text}</Text> : null}
                      </View>
                    </View>
                  )
                }}
                contentContainerStyle={{ padding: 8 }}
                ListEmptyComponent={<Text style={[s.subtext, { textAlign: 'center', padding: 20 }]}>No messages</Text>}
              />
            )}
          </View>
          <View style={s.inputRow}>
            <TextInput value={draft} onChangeText={setDraft} placeholder={`Message...`} placeholderTextColor={colors.textMuted}
              style={s.chatInput} onSubmitEditing={sendMsg} returnKeyType="send" />
            <TouchableOpacity onPress={sendMsg} disabled={!draft.trim() || sending}
              style={[s.sendBtn, (!draft.trim() || sending) && { opacity: 0.5 }]}>
              <Text style={s.sendText}>{sending ? '...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

function ChatsView({ leagues, userId }: { leagues: LeagueDetailed[]; userId: string }) {
  const [sortMode, setSortMode] = useState<SortMode>('original')
  const [lastTimes, setLastTimes] = useState<Record<string, number>>({})
  const updateLast = useCallback((id: string, t: number) => {
    setLastTimes((p) => p[id] === t ? p : { ...p, [id]: t })
  }, [])

  const sorted = useMemo(() => {
    const list = [...leagues]
    if (sortMode === 'alpha') return list.sort((a, b) => a.name.localeCompare(b.name))
    if (sortMode === 'recent') return list.sort((a, b) => (lastTimes[b.league_id] ?? 0) - (lastTimes[a.league_id] ?? 0))
    return list
  }, [leagues, sortMode, lastTimes])

  const sorts: { mode: SortMode; label: string }[] = [{ mode: 'original', label: 'Default' }, { mode: 'alpha', label: 'A-Z' }, { mode: 'recent', label: 'Recent' }]

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: colors.card, paddingVertical: 8 }}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 16, alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>Sort</Text>
        {sorts.map((st) => (
          <TouchableOpacity key={st.mode} onPress={() => setSortMode(st.mode)}
            style={[s.miniFilterBtn, sortMode === st.mode && s.miniFilterBtnActive]}>
            <Text style={[s.miniFilterText, sortMode === st.mode && s.miniFilterTextActive]}>{st.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList data={sorted} keyExtractor={(l) => l.league_id}
        renderItem={({ item }) => <ChatCard league={item} userId={userId} onLastMessage={updateLast} />}
        contentContainerStyle={{ padding: 12 }} />
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────

export default function LeaguesScreen() {
  const { leagues, loading, error } = useLeagueCache()
  const { ktc, loading: ktcLoading } = useKtc()
  const { allplayers, loading: apLoading } = useAllPlayers()
  const { session } = useAuth()
  const [tab, setTab] = useState<LeaguesTab>('ranks')

  const leagueList = useMemo(() => (leagues ? Object.values(leagues) : []), [leagues])

  if ((loading || ktcLoading || apLoading) && leagueList.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blueLight} />
        <Text style={[s.subtext, { marginTop: 12 }]}>Loading...</Text>
      </View>
    )
  }

  if (error) {
    return <View style={s.center}><Text style={{ color: colors.red }}>{error}</Text></View>
  }

  return (
    <View style={s.container}>
      {/* Subtabs */}
      <View style={s.tabBar}>
        {(['ranks', 'chats'] as LeaguesTab[]).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'ranks' ? 'Ranks' : 'Chats'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'ranks' ? (
        <RanksView leagues={leagueList} allplayers={allplayers} ktc={ktc} />
      ) : (
        <ChatsView leagues={leagueList} userId={session?.user_id ?? ''} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  // Tabs
  tabBar: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.card },
  tabBtn: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 8 },
  tabBtnActive: { backgroundColor: colors.blue },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  tabTextActive: { color: colors.white },
  // Control bar
  controlBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.card },
  segmented: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 8, padding: 2 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  segBtnActive: { backgroundColor: colors.blue },
  segText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  segTextActive: { color: colors.white },
  statsText: { color: colors.textMuted, fontSize: 11, marginLeft: 12 },
  // Cards
  card: { backgroundColor: colors.card, borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  leagueName: { color: colors.white, fontWeight: '600', fontSize: 15 },
  subtext: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  // Rank grid
  rankBox: { alignItems: 'center', backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 60 },
  rankLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '500' },
  rankNum: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  rankVal: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  // Expanded
  expandedSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  miniFilterBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.bg },
  miniFilterBtnActive: { backgroundColor: colors.blue },
  miniFilterText: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  miniFilterTextActive: { color: colors.white },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5 },
  rankRowUser: { backgroundColor: 'rgba(59,130,246,0.1)' },
  rankRowNum: { width: 30, fontSize: 13, fontWeight: '700' },
  rankRowName: { flex: 1, color: colors.text, fontSize: 13 },
  rankRowVal: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  // Chat
  bubble: { maxWidth: '75%', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  bubbleMe: { backgroundColor: 'rgba(37,99,235,0.2)' },
  bubbleOther: { backgroundColor: colors.border },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1, borderTopColor: colors.border },
  chatInput: { flex: 1, backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.border },
  sendBtn: { marginLeft: 6, backgroundColor: colors.blue, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  sendText: { color: colors.white, fontSize: 13, fontWeight: '600' },
})
