import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import type { LeagueDetailed, Message, MessagesResult, CreateMessageResult } from '@autogm/shared'
import { useLeagueCache } from '../../../src/league-cache'
import { useAuth } from '@autogm/shared/react'
import { mobileDataClient } from '../../../src/data-client'
import { colors } from '../../../src/theme'

function formatTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function LeagueChatCard({ league, userId }: { league: LeagueDetailed; userId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const flatListRef = useRef<FlatList>(null)

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    try {
      const result = await mobileDataClient.graphql('messages', { parent_id: league.league_id })
      setMessages((result as MessagesResult).messages ?? [])
    } catch (e) {
      console.warn('Chat fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [league.league_id])

  useEffect(() => {
    if (expanded) fetchMessages()
  }, [expanded, fetchMessages])

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
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

export default function ChatsScreen() {
  const { leagues, loading } = useLeagueCache()
  const { session } = useAuth()
  const leagueList = useMemo(() => (leagues ? Object.values(leagues) : []), [leagues])

  if (loading && leagueList.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blueLight} />
      </View>
    )
  }

  return (
    <FlatList
      data={leagueList}
      keyExtractor={(l) => l.league_id}
      renderItem={({ item }) => (
        <LeagueChatCard league={item} userId={session?.user_id ?? ''} />
      )}
      contentContainerStyle={{ padding: 16, backgroundColor: colors.bg }}
      style={{ backgroundColor: colors.bg }}
    />
  )
}

const s = StyleSheet.create({
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
  sendBtn: { marginLeft: 8, backgroundColor: colors.blue, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  sendText: { color: colors.white, fontSize: 13, fontWeight: '600' },
})
