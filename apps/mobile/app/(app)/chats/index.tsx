import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import type { LeagueDetailed, Message, MessagesResult, CreateMessageResult } from '@autogm/shared'
import { useLeagueCache } from '../../../src/league-cache'
import { useAuth } from '@autogm/shared/react'
import { mobileDataClient } from '../../../src/data-client'
import { colors } from '../../../src/theme'

const EMOJI_CATEGORIES = [
  { label: 'Smileys', emojis: ['😂', '🤣', '😭', '💀', '🔥', '❤️', '😤', '😈', '🥶', '🤡', '😎', '🤔', '😏', '🙄', '😬', '💯', '👀', '🤝', '👏', '🫠'] },
  { label: 'Sports', emojis: ['🏈', '🏆', '🥇', '📈', '📉', '💰', '🎯', '⚡', '🚀', '💪', '🧠', '👑', '🐐', '🗑️', '💩', '🤮', '🫡', '🍻', '🥳', '🎉'] },
  { label: 'Reactions', emojis: ['👍', '👎', '🤷', '🙏', '✅', '❌', '⚠️', '🚨', '📢', '🔔', '💤', '😢', '😡', '🤦', '💔', '🫣', '⁉️', '‼️', '🥴', '😮‍💨'] },
]

function formatTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function LeagueChatCard({ league, userId, onLastMessage }: { league: LeagueDetailed; userId: string; onLastMessage?: (leagueId: string, time: number) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const flatListRef = useRef<FlatList>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState<{ id: string; url: string; preview: string }[]>([])
  const [gifSearching, setGifSearching] = useState(false)

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const result = await mobileDataClient.graphql('messages', { parent_id: league.league_id })
      const msgs = (result as MessagesResult).messages ?? []
      setMessages(msgs)
      if (msgs.length > 0 && onLastMessage) {
        const latest = Math.max(...msgs.map((m) => m.created))
        onLastMessage(league.league_id, latest)
      }
    } catch (e) {
      console.warn('Chat fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [league.league_id])

  // Prefetch on mount for preview, refetch on expand
  useEffect(() => {
    fetchMessages(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (expanded) fetchMessages()
  }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.created - b.created),
    [messages],
  )

  const sendMessage = useCallback(async () => {
    const text = draftRef.current.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await mobileDataClient.graphql('createLeagueMessage' as any, {
        parent_id: league.league_id,
        text,
      } as any)
      setDraft('')
      await fetchMessages()
    } catch (e) {
      console.warn('Send failed:', e)
    } finally {
      setSending(false)
    }
  }, [league.league_id, sending, fetchMessages])

  const lastMsg = sorted.length > 0 ? sorted[sorted.length - 1] : null

  return (
    <View style={s.card}>
      <TouchableOpacity onPress={() => setExpanded((p) => !p)} style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.leagueName}>{league.name}</Text>
          {!expanded && lastMsg && (
            <Text style={s.preview} numberOfLines={1}>
              {lastMsg.author_display_name}: {lastMsg.text || '...'}
            </Text>
          )}
          {!expanded && !lastMsg && (
            <Text style={s.subtext}>{league.rosters.length} teams</Text>
          )}
        </View>
        {!expanded && lastMsg && (
          <Text style={s.time}>{formatTime(lastMsg.created)}</Text>
        )}
      </TouchableOpacity>

      {expanded && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ maxHeight: 300 }}>
            {loading && messages.length === 0 ? (
              <View style={s.center}>
                <ActivityIndicator size="small" color={colors.blueLight} />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={sorted}
                keyExtractor={(m) => m.message_id}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => {
                  const isUser = item.author_id === userId
                  return (
                    <View style={[s.msgRow, isUser ? s.msgRight : s.msgLeft]}>
                      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleOther]}>
                        <Text style={s.msgAuthor}>{item.author_display_name}</Text>
                        {item.text ? <Text style={s.msgText}>{item.text}</Text> : null}
                      </View>
                    </View>
                  )
                }}
                contentContainerStyle={{ padding: 12 }}
                ListEmptyComponent={
                  <Text style={[s.subtext, { textAlign: 'center', padding: 24 }]}>No messages</Text>
                }
              />
            )}
          </View>
          <View style={s.inputRow}>
            {/* Emoji */}
            <TouchableOpacity onPress={() => { setShowEmoji((p) => !p); setShowGif(false) }} style={s.iconBtn}>
              <Text style={{ fontSize: 18 }}>😊</Text>
            </TouchableOpacity>
            {/* GIF */}
            <TouchableOpacity onPress={() => { setShowGif((p) => !p); setShowEmoji(false) }} style={s.gifBtn}>
              <Text style={s.gifBtnText}>GIF</Text>
            </TouchableOpacity>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={`Message ${league.name}...`}
              placeholderTextColor={colors.textMuted}
              style={s.input}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!draft.trim() || sending}
              style={[s.sendBtn, (!draft.trim() || sending) && { opacity: 0.5 }]}
            >
              <Text style={s.sendText}>{sending ? '...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
          {/* Emoji picker */}
          {showEmoji && (
            <View style={s.pickerPanel}>
              <ScrollView horizontal={false} style={{ maxHeight: 160 }}>
                {EMOJI_CATEGORIES.map((cat) => (
                  <View key={cat.label} style={{ marginBottom: 8 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 2 }}>{cat.label}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
                      {cat.emojis.map((e) => (
                        <TouchableOpacity key={e} onPress={() => { setDraft((p) => p + e); setShowEmoji(false) }} style={s.emojiBtn}>
                          <Text style={{ fontSize: 18 }}>{e}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          {/* GIF picker */}
          {showGif && (
            <View style={s.pickerPanel}>
              <TextInput
                value={gifQuery}
                onChangeText={(q) => {
                  setGifQuery(q)
                  if (!q.trim()) { setGifResults([]); return }
                  setGifSearching(true)
                  fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=AIzaSyC-P6RbEhWxUhtjTAANbYz4WB-YGlavnD0&limit=12&media_filter=tinygif,tinymp4`)
                    .then((r) => r.json())
                    .then((d) => setGifResults((d.results ?? []).map((g: any) => ({
                      id: g.id,
                      url: g.media_formats?.tinymp4?.url ?? g.media_formats?.tinygif?.url ?? '',
                      preview: g.media_formats?.tinygif?.url ?? '',
                    }))))
                    .finally(() => setGifSearching(false))
                }}
                placeholder="Search GIFs..."
                placeholderTextColor={colors.textMuted}
                style={[s.input, { marginBottom: 6 }]}
              />
              <ScrollView style={{ maxHeight: 140 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {gifResults.map((g) => (
                    <TouchableOpacity key={g.id} onPress={async () => {
                      setShowGif(false)
                      setSending(true)
                      try {
                        await mobileDataClient.graphql('createLeagueMessage' as any, {
                          parent_id: league.league_id,
                          text: '',
                          attachment_type: 'gif',
                          k_attachment_data: ['original_mp4', 'original_still', 'fixed_height_mp4', 'fixed_height_still'],
                          v_attachment_data: [g.url, g.preview, g.url, g.preview],
                        } as any)
                        await fetchMessages()
                      } catch {} finally { setSending(false) }
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <View style={{ width: 80, height: 60, backgroundColor: colors.card, borderRadius: 6, overflow: 'hidden' }}>
                        <Text style={{ color: colors.textMuted, fontSize: 8, textAlign: 'center', paddingTop: 20 }}>GIF</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

type SortMode = 'original' | 'alpha' | 'recent'

export default function ChatsScreen() {
  const { leagues, loading } = useLeagueCache()
  const { session } = useAuth()
  const [sortMode, setSortMode] = useState<SortMode>('original')
  const [lastMsgTimes, setLastMsgTimes] = useState<Record<string, number>>({})

  const leagueList = useMemo(() => (leagues ? Object.values(leagues) : []), [leagues])

  const sortedLeagues = useMemo(() => {
    const list = [...leagueList]
    switch (sortMode) {
      case 'alpha': return list.sort((a, b) => a.name.localeCompare(b.name))
      case 'recent': return list.sort((a, b) => (lastMsgTimes[b.league_id] ?? 0) - (lastMsgTimes[a.league_id] ?? 0))
      default: return list
    }
  }, [leagueList, sortMode, lastMsgTimes])

  const updateLastMsg = useCallback((leagueId: string, time: number) => {
    setLastMsgTimes((prev) => prev[leagueId] === time ? prev : { ...prev, [leagueId]: time })
  }, [])

  if (loading && leagueList.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blueLight} />
      </View>
    )
  }

  const sorts: { mode: SortMode; label: string }[] = [
    { mode: 'original', label: 'Default' },
    { mode: 'alpha', label: 'A-Z' },
    { mode: 'recent', label: 'Recent' },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.sortBar} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
        <Text style={s.sortLabel}>Sort</Text>
        {sorts.map((st) => (
          <TouchableOpacity
            key={st.mode}
            onPress={() => setSortMode(st.mode)}
            style={[s.sortBtn, sortMode === st.mode && s.sortBtnActive]}
          >
            <Text style={[s.sortText, sortMode === st.mode && s.sortTextActive]}>{st.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={sortedLeagues}
        keyExtractor={(l) => l.league_id}
        renderItem={({ item }) => (
          <LeagueChatCard league={item} userId={session?.user_id ?? ''} onLastMessage={updateLastMsg} />
        )}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  sortBar: { borderBottomWidth: 1, borderBottomColor: colors.card, paddingVertical: 10 },
  sortLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'center', marginRight: 4 },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card },
  sortBtnActive: { backgroundColor: colors.blue },
  sortText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  sortTextActive: { color: colors.white },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.card, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  leagueName: { color: colors.white, fontWeight: '600', fontSize: 15 },
  subtext: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  preview: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  time: { color: colors.textDim, fontSize: 10 },
  msgRow: { marginBottom: 4 },
  msgRight: { alignItems: 'flex-end' },
  msgLeft: { alignItems: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  bubbleUser: { backgroundColor: 'rgba(37,99,235,0.2)' },
  bubbleOther: { backgroundColor: colors.border },
  msgAuthor: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginBottom: 1 },
  msgText: { color: colors.text, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.border },
  iconBtn: { padding: 4 },
  gifBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  gifBtnText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  sendBtn: { marginLeft: 8, backgroundColor: colors.blue, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  sendText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  pickerPanel: { paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  emojiBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
})
