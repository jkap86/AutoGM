import { useState, useMemo, useEffect } from 'react'
import { View, Text, FlatList, ActivityIndicator, Image, TouchableOpacity, TextInput, ScrollView } from 'react-native'
import type { LeagueDetailed, Roster, Allplayer } from '@autogm/shared'
import { useLeagueCache } from '../../src/league-cache'
import { useKtc } from '../../src/hooks/use-ktc'
import { useAdp } from '../../src/hooks/use-adp'
import { useAllPlayers } from '../../src/hooks/use-allplayers'
import { useAuth } from '@autogm/shared/react'
import { type ValueType, buildValueLookup, formatValue, getPickKtcName } from '../../src/utils/value-lookup'
import { mobileDataClient } from '../../src/data-client'
import type { Message, MessagesResult, CreateMessageResult } from '@autogm/shared'
import { useCallback, useRef } from 'react'

type LeaguesTab = 'ranks' | 'chats'
type PositionFilter = 'ALL' | 'PLAYERS' | 'PLAYERS+CUR' | 'QB' | 'RB' | 'WR' | 'TE' | 'PICKS'

const RANK_CATEGORIES: { label: string; filter: PositionFilter }[] = [
  { label: 'Overall', filter: 'ALL' },
  { label: 'Players', filter: 'PLAYERS' },
  { label: 'Plyr+Cur', filter: 'PLAYERS+CUR' },
  { label: 'QB', filter: 'QB' },
  { label: 'RB', filter: 'RB' },
  { label: 'WR', filter: 'WR' },
  { label: 'TE', filter: 'TE' },
  { label: 'Picks', filter: 'PICKS' },
]

const EMOJI_CATEGORIES = [
  { label: 'Smileys', emojis: ['😂', '🤣', '😭', '💀', '🔥', '❤️', '😤', '😈', '🥶', '🤡', '😎', '🤔', '😏', '🙄', '😬', '💯', '👀', '🤝', '👏', '🫠'] },
  { label: 'Sports', emojis: ['🏈', '🏆', '🥇', '📈', '📉', '💰', '🎯', '⚡', '🚀', '💪', '🧠', '👑', '🐐', '🗑️', '💩', '🤮', '🫡', '🍻', '🥳', '🎉'] },
  { label: 'Reactions', emojis: ['👍', '👎', '🤷', '🙏', '✅', '❌', '⚠️', '🚨', '📢', '🔔', '💤', '😢', '😡', '🤦', '💔', '🫣', '⁉️', '‼️', '🥴', '😮‍💨'] },
]

function computeRosterValue(
  roster: Roster, filter: PositionFilter, values: Record<string, number>, allplayers: Record<string, Allplayer>, currentSeason?: string,
): number {
  const vals: number[] = []
  if (filter !== 'PICKS') {
    for (const pid of roster.players ?? []) {
      const player = allplayers[pid]
      if (!player) continue
      if (filter !== 'ALL' && filter !== 'PLAYERS' && filter !== 'PLAYERS+CUR' && player.position !== filter) continue
      vals.push(values[pid] ?? 0)
    }
  }
  if (filter === 'ALL' || filter === 'PICKS' || filter === 'PLAYERS+CUR') {
    for (const pick of roster.draftpicks ?? []) {
      if (filter === 'PLAYERS+CUR' && pick.season !== currentSeason) continue
      vals.push(values[getPickKtcName(pick.season, pick.round, pick.order)] ?? 0)
    }
  }
  return vals.reduce((a, b) => a + b, 0)
}

function rankColor(rank: number | null, total: number): string {
  if (rank === 1) return '#FB923C'
  if (rank != null && rank <= 3) return '#4ADE80'
  if (rank != null && rank >= total - 2) return '#F87171'
  return '#F3F4F6'
}

function getRank(league: LeagueDetailed, rosterId: number, filter: PositionFilter, values: Record<string, number>, allplayers: Record<string, Allplayer>): number {
  const totals = league.rosters.map((r) => ({ rid: r.roster_id, total: computeRosterValue(r, filter, values, allplayers, league.season) }))
  totals.sort((a, b) => b.total - a.total)
  return totals.findIndex((t) => t.rid === rosterId) + 1
}

function LeagueRankCard({
  league, values, allplayers, valueType,
}: {
  league: LeagueDetailed; values: Record<string, number>; allplayers: Record<string, Allplayer>; valueType: ValueType
}) {
  const [expanded, setExpanded] = useState(false)
  const [expandedFilter, setExpandedFilter] = useState<PositionFilter>('ALL')
  const total = league.rosters.length

  return (
    <View className="bg-gray-800 rounded-xl mb-2.5 overflow-hidden">
      <TouchableOpacity onPress={() => setExpanded((p) => !p)} className="flex-row items-center p-3">
        {league.avatar ? (
          <Image source={{ uri: `https://sleepercdn.com/avatars/thumbs/${league.avatar}` }} className="w-8 h-8 rounded-full mr-2.5" />
        ) : (
          <View className="w-8 h-8 rounded-full mr-2.5 bg-gray-700 items-center justify-center">
            <Text style={{ fontSize: 16 }}>🏈</Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-white font-semibold text-[15px]">{league.name}</Text>
          <Text className="text-gray-400 text-xs mt-0.5">
            {league.season} · {league.settings.type === 2 ? 'Dynasty' : league.settings.type === 1 ? 'Keeper' : 'Redraft'} · {total} teams · {league.user_roster.wins}-{league.user_roster.losses}{league.user_roster.ties > 0 ? `-${league.user_roster.ties}` : ''}
          </Text>
        </View>
      </TouchableOpacity>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingBottom: 12 }}>
        {RANK_CATEGORIES.map(({ label, filter }) => {
          const rank = getRank(league, league.user_roster.roster_id, filter, values, allplayers)
          const value = computeRosterValue(league.user_roster, filter, values, allplayers)
          return (
            <View key={filter} className="items-center bg-gray-900 rounded-lg px-2.5 py-1.5 min-w-[60px]">
              <Text className="text-gray-500 text-[10px] font-medium">{label}</Text>
              <Text style={{ color: rankColor(rank, total), fontSize: 16, fontWeight: '800', marginTop: 2 }}>#{rank}</Text>
              <Text className="text-gray-500 text-[10px] mt-0.5">{formatValue(value, valueType)}</Text>
            </View>
          )
        })}
      </ScrollView>

      {expanded && (
        <View className="border-t border-gray-700 pt-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingHorizontal: 12, paddingBottom: 8 }}>
            {RANK_CATEGORIES.map(({ label, filter }) => (
              <TouchableOpacity key={filter} onPress={() => setExpandedFilter(filter)}
                className={`px-2.5 py-1 rounded-xl ${expandedFilter === filter ? 'bg-blue-600' : 'bg-gray-900'}`}>
                <Text className={`text-[11px] font-medium ${expandedFilter === filter ? 'text-white' : 'text-gray-500'}`}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {league.rosters
            .map((r) => ({ roster: r, value: computeRosterValue(r, expandedFilter, values, allplayers) }))
            .sort((a, b) => b.value - a.value)
            .map((entry, i) => {
              const isUser = entry.roster.roster_id === league.user_roster.roster_id
              return (
                <View key={entry.roster.roster_id} className={`flex-row items-center px-3 py-1.5 ${isUser ? 'bg-blue-600/10' : ''}`}>
                  <Text style={{ color: rankColor(i + 1, total), width: 30, fontSize: 13, fontWeight: '700' }}>#{i + 1}</Text>
                  <Text className={`flex-1 text-[13px] ${isUser ? 'text-blue-400' : 'text-gray-100'}`} numberOfLines={1}>{entry.roster.username}</Text>
                  <Text className="text-gray-500 text-xs font-semibold">{formatValue(entry.value, valueType)}</Text>
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
    <View className="flex-1">
      <View className="flex-row items-center px-3 py-2 border-b border-gray-800">
        <View className="flex-row bg-gray-800 rounded-lg p-0.5">
          {valueTypes.map((v) => (
            <TouchableOpacity key={v} onPress={() => setValueType(v)}
              className={`px-3.5 py-1.5 rounded-md ${valueType === v ? 'bg-blue-600' : ''}`}>
              <Text className={`text-xs font-semibold ${valueType === v ? 'text-white' : 'text-gray-500'}`}>{v.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {isAdp && stats && !adpLoading && (
          <Text className="text-gray-500 text-[11px] ml-3">{stats.n_drafts.toLocaleString()} drafts</Text>
        )}
        {adpLoading && <ActivityIndicator size="small" color="#60A5FA" className="ml-2" />}
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
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState<{ id: string; url: string; preview: string }[]>([])

  const fetchMsgs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const r = await mobileDataClient.graphql('messages', { parent_id: league.league_id })
      const msgs = (r as MessagesResult).messages ?? []
      setMessages(msgs)
      if (msgs.length > 0 && onLastMessage) onLastMessage(league.league_id, Math.max(...msgs.map((m) => m.created)))
    } catch {} finally { if (!silent) setLoading(false) }
  }, [league.league_id, onLastMessage])

  useEffect(() => { fetchMsgs(true) }, [])
  useEffect(() => { if (expanded) fetchMsgs() }, [expanded])

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
    <View className="bg-gray-800 rounded-xl mb-2.5 overflow-hidden">
      <TouchableOpacity onPress={() => setExpanded((p) => !p)} className="flex-row items-center p-3">
        <View className="flex-1">
          <Text className="text-white font-semibold text-[15px]">{league.name}</Text>
          {!expanded && lastMsg ? (
            <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>{lastMsg.author_display_name}: {lastMsg.text || '...'}</Text>
          ) : (
            <Text className="text-gray-400 text-xs mt-0.5">{league.rosters.length} teams</Text>
          )}
        </View>
        {!expanded && lastMsg && <Text className="text-gray-600 text-[10px]">{formatTime(lastMsg.created)}</Text>}
      </TouchableOpacity>

      {expanded && (
        <View className="border-t border-gray-700">
          <View style={{ maxHeight: 260 }}>
            {loading && messages.length === 0 ? (
              <View className="p-6 items-center"><ActivityIndicator size="small" color="#60A5FA" /></View>
            ) : (
              <FlatList ref={flatListRef} data={sorted} keyExtractor={(m) => m.message_id}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => {
                  const isMe = item.author_id === userId
                  return (
                    <View className={`mb-1 ${isMe ? 'items-end' : 'items-start'}`}>
                      <View className={`max-w-[75%] rounded-xl px-2.5 py-1.5 ${isMe ? 'bg-blue-600/20' : 'bg-gray-700'}`}>
                        <Text className="text-gray-500 text-[10px] font-semibold">{item.author_display_name}</Text>
                        {item.text ? <Text className="text-gray-100 text-[13px]">{item.text}</Text> : null}
                      </View>
                    </View>
                  )
                }}
                contentContainerStyle={{ padding: 8 }}
                ListEmptyComponent={<Text className="text-gray-400 text-center p-5 text-xs">No messages</Text>}
              />
            )}
          </View>
          <View className="flex-row items-center p-2 border-t border-gray-700">
            <TouchableOpacity onPress={() => { setShowEmoji((p) => !p); setShowGif(false) }} className="p-1">
              <Text style={{ fontSize: 18 }}>😊</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowGif((p) => !p); setShowEmoji(false) }}
              className="border border-gray-700 rounded px-1.5 py-0.5">
              <Text className="text-gray-500 text-[10px] font-bold">GIF</Text>
            </TouchableOpacity>
            <TextInput value={draft} onChangeText={setDraft} placeholder="Message..." placeholderTextColor="#6B7280"
              className="flex-1 bg-gray-900 rounded-lg px-2.5 py-1.5 text-gray-100 text-[13px] border border-gray-700 mx-1.5"
              onSubmitEditing={sendMsg} returnKeyType="send" />
            <TouchableOpacity onPress={sendMsg} disabled={!draft.trim() || sending}
              className={`bg-blue-600 rounded-lg px-3 py-1.5 ${(!draft.trim() || sending) ? 'opacity-50' : ''}`}>
              <Text className="text-white text-[13px] font-semibold">{sending ? '...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
          {showEmoji && (
            <View className="px-2 py-1.5 border-t border-gray-700">
              <ScrollView style={{ maxHeight: 140 }}>
                {EMOJI_CATEGORIES.map((cat) => (
                  <View key={cat.label} className="mb-1.5">
                    <Text className="text-gray-500 text-[10px]">{cat.label}</Text>
                    <View className="flex-row flex-wrap gap-0.5">
                      {cat.emojis.map((e) => (
                        <TouchableOpacity key={e} onPress={() => { setDraft((p) => p + e); setShowEmoji(false) }}
                          className="w-8 h-8 items-center justify-center">
                          <Text style={{ fontSize: 18 }}>{e}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          {showGif && (
            <View className="px-2 py-1.5 border-t border-gray-700">
              <TextInput value={gifQuery} placeholder="Search GIFs..." placeholderTextColor="#6B7280"
                className="bg-gray-900 rounded-lg px-2.5 py-1.5 text-gray-100 text-[13px] border border-gray-700 mb-1.5"
                onChangeText={(q) => {
                  setGifQuery(q)
                  if (!q.trim()) { setGifResults([]); return }
                  fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=AIzaSyC-P6RbEhWxUhtjTAANbYz4WB-YGlavnD0&limit=12&media_filter=tinygif,tinymp4`)
                    .then((r) => r.json())
                    .then((d) => setGifResults((d.results ?? []).map((g: any) => ({
                      id: g.id, url: g.media_formats?.tinymp4?.url ?? '', preview: g.media_formats?.tinygif?.url ?? '',
                    }))))
                }} />
              <ScrollView style={{ maxHeight: 120 }}>
                <View className="flex-row flex-wrap gap-1">
                  {gifResults.map((g) => (
                    <TouchableOpacity key={g.id} onPress={async () => {
                      setShowGif(false); setSending(true)
                      try {
                        await mobileDataClient.graphql('createLeagueMessage' as any, {
                          parent_id: league.league_id, text: '', attachment_type: 'gif',
                          k_attachment_data: ['original_mp4', 'original_still', 'fixed_height_mp4', 'fixed_height_still'],
                          v_attachment_data: [g.url, g.preview, g.url, g.preview],
                        } as any)
                        await fetchMsgs()
                      } catch {} finally { setSending(false) }
                    }} className="w-20 h-[60px] bg-gray-800 rounded-md items-center justify-center">
                      <Text className="text-gray-500 text-[8px]">GIF</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
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
    <View className="flex-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border-b border-gray-800 py-2"
        contentContainerStyle={{ gap: 6, paddingHorizontal: 16, alignItems: 'center' }}>
        <Text className="text-gray-500 text-[10px] font-semibold uppercase">Sort</Text>
        {sorts.map((st) => (
          <TouchableOpacity key={st.mode} onPress={() => setSortMode(st.mode)}
            className={`px-2.5 py-1 rounded-xl ${sortMode === st.mode ? 'bg-blue-600' : 'bg-gray-900'}`}>
            <Text className={`text-[11px] font-medium ${sortMode === st.mode ? 'text-white' : 'text-gray-500'}`}>{st.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList data={sorted} keyExtractor={(l) => l.league_id}
        renderItem={({ item }) => <ChatCard league={item} userId={userId} onLastMessage={updateLast} />}
        contentContainerStyle={{ padding: 12 }} />
    </View>
  )
}

export default function LeaguesScreen() {
  const { leagues, loading, error } = useLeagueCache()
  const { ktc, loading: ktcLoading } = useKtc()
  const { allplayers, loading: apLoading } = useAllPlayers()
  const { session } = useAuth()
  const [tab, setTab] = useState<LeaguesTab>('ranks')

  const leagueList = useMemo(() => (leagues ? Object.values(leagues) : []), [leagues])

  if ((loading || ktcLoading || apLoading) && leagueList.length === 0) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center p-6">
        <ActivityIndicator size="large" color="#60A5FA" />
        <Text className="text-gray-400 text-xs mt-3">Loading...</Text>
      </View>
    )
  }

  if (error) {
    return <View className="flex-1 bg-gray-900 items-center justify-center p-6"><Text className="text-red-400">{error}</Text></View>
  }

  return (
    <View className="flex-1 bg-gray-900">
      <View className="flex-row justify-center gap-1 py-2 border-b border-gray-800">
        {(['ranks', 'chats'] as LeaguesTab[]).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            className={`px-5 py-1.5 rounded-lg ${tab === t ? 'bg-blue-600' : ''}`}>
            <Text className={`text-[13px] font-semibold uppercase ${tab === t ? 'text-white' : 'text-gray-500'}`}>
              {t === 'ranks' ? 'Ranks' : 'Chats'}
            </Text>
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
