import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import type { Message, MessagesResult, GetDmByMembersResult, CreateDmResult, MessageCreatedPayload } from '@autogm/shared'
import { SleeperTopics, messageFromSocket } from '@autogm/shared'
import { useAuth } from '@autogm/shared/react'
import { useLeagueCache } from '../../../src/league-cache'
import { mobileDataClient } from '../../../src/data-client'
import { useGatewayTopic } from '../../../src/contexts/socket-context'
import { MessageBubble } from '../../../src/components/message-bubble'

type DmPartner = {
  user_id: string
  username: string
  avatar: string | null
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function DmCard({ partner, userId }: { partner: DmPartner; userId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [dmId, setDmId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const flatListRef = useRef<FlatList>(null)
  const [lastPreview, setLastPreview] = useState<{ text: string; time: number } | null>(null)

  const fetchDmAndMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const dmResult = await mobileDataClient.graphql('getDmByMembers', { members: [userId, partner.user_id] })
      const dm = (dmResult as GetDmByMembersResult).get_dm_by_members
      if (!dm?.dm_id) {
        setDmId(null)
        setMessages([])
        if (!silent) setLoading(false)
        return
      }
      setDmId(dm.dm_id)

      // Set preview from DM metadata if we haven't fetched messages yet
      if (dm.last_message_text && dm.last_message_time) {
        setLastPreview({ text: dm.last_message_text, time: dm.last_message_time })
      }

      const msgResult = await mobileDataClient.graphql('messages', { parent_id: dm.dm_id })
      const msgs = (msgResult as MessagesResult).messages ?? []
      setMessages(msgs)
      if (msgs.length > 0) {
        const latest = msgs.reduce((a, b) => a.created > b.created ? a : b)
        setLastPreview({ text: latest.text || '...', time: latest.created })
      }
    } catch (e) {
      console.warn('DM fetch failed:', e)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [userId, partner.user_id])

  // Lazy load: fetch DM info on first expand
  const hasLoaded = useRef(false)
  useEffect(() => {
    if (expanded && !hasLoaded.current) {
      hasLoaded.current = true
      fetchDmAndMessages()
    } else if (expanded) {
      fetchDmAndMessages()
    }
  }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch preview (just DM metadata, no full messages)
  useEffect(() => {
    ;(async () => {
      try {
        const dmResult = await mobileDataClient.graphql('getDmByMembers', { members: [userId, partner.user_id] })
        const dm = (dmResult as GetDmByMembersResult).get_dm_by_members
        if (dm?.dm_id) {
          setDmId(dm.dm_id)
          if (dm.last_message_text && dm.last_message_time) {
            setLastPreview({ text: dm.last_message_text, time: dm.last_message_time })
          }
        }
      } catch (e) { console.warn('[chats]', e instanceof Error ? e.message : e) }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time message updates
  useGatewayTopic(
    expanded && userId ? SleeperTopics.user(userId) : null,
    useCallback((event: string, payload: unknown) => {
      if (event === 'message_created') {
        const msg = messageFromSocket(payload as MessageCreatedPayload)
        if (msg.parent_id === dmId) {
          setMessages((prev) => {
            if (prev.some((m) => m.message_id === msg.message_id)) return prev
            return [...prev, msg]
          })
          setLastPreview({ text: msg.text || '...', time: msg.created })
        }
      }
    }, [dmId]),
  )

  const createDmAndSend = useCallback(async () => {
    const text = draftRef.current.trim()
    if (!text || sending) return
    setSending(true)
    try {
      let id = dmId
      if (!id) {
        const result = await mobileDataClient.graphql('createDm', {
          members: [userId, partner.user_id],
          dm_type: 'direct',
        })
        id = (result as CreateDmResult).create_dm?.dm_id
        if (!id) throw new Error('Failed to create DM')
        setDmId(id)
      }
      await mobileDataClient.graphql('createMessage', {
        parent_id: id,
        text,
        k_attachment_data: [],
        v_attachment_data: [],
      })
      setDraft('')
      await fetchDmAndMessages()
    } catch (e) {
      console.warn('Send DM failed:', e)
    } finally {
      setSending(false)
    }
  }, [dmId, userId, partner.user_id, sending, fetchDmAndMessages])

  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.created - b.created),
    [messages],
  )

  return (
    <View className="bg-gray-800 rounded-xl border border-gray-700/80 mb-2.5 overflow-hidden">
      <TouchableOpacity onPress={() => setExpanded((p) => !p)} className="flex-row items-center p-3">
        <View className="w-9 h-9 rounded-full mr-2.5 bg-gray-700 items-center justify-center">
          <Text className="text-white text-sm font-bold">
            {partner.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-white font-semibold text-[15px] font-heading">{partner.username}</Text>
          {!expanded && lastPreview ? (
            <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>{lastPreview.text}</Text>
          ) : !expanded ? (
            <Text className="text-gray-500 text-xs mt-0.5">Tap to open DM</Text>
          ) : null}
        </View>
        {!expanded && lastPreview && (
          <Text className="text-gray-600 text-[10px]">{formatTime(lastPreview.time)}</Text>
        )}
      </TouchableOpacity>

      {expanded && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="border-t border-gray-700">
          <View style={{ maxHeight: 300 }}>
            {loading && messages.length === 0 ? (
              <View className="p-6 items-center">
                <ActivityIndicator size="small" color="#60A5FA" />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={sorted}
                keyExtractor={(m) => m.message_id}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => (
                  <MessageBubble
                    msg={item}
                    isMe={item.author_id === userId}
                    userId={userId}
                    parentId={dmId ?? ''}
                  />
                )}
                contentContainerStyle={{ padding: 8 }}
                ListEmptyComponent={
                  <Text className="text-gray-400 text-center p-5 text-xs">
                    {dmId ? 'No messages yet' : 'No DM exists yet - send a message to start one'}
                  </Text>
                }
              />
            )}
          </View>
          <View className="flex-row items-center p-2 border-t border-gray-700">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={`Message ${partner.username}...`}
              placeholderTextColor="#6B7280"
              className="flex-1 bg-gray-900 rounded-lg px-2.5 py-1.5 text-gray-100 text-[13px] border border-gray-700 mx-1.5"
              onSubmitEditing={createDmAndSend}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={createDmAndSend}
              disabled={!draft.trim() || sending}
              className={`bg-blue-600 rounded-lg px-3 py-1.5 ${(!draft.trim() || sending) ? 'opacity-50' : ''}`}
              accessibilityLabel="Send message"
            >
              <Text className="text-white text-[13px] font-semibold">{sending ? '...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

export default function DmsScreen() {
  const { leagues, loading } = useLeagueCache()
  const { session } = useAuth()
  const userId = session?.user_id ?? ''

  // Build deduplicated partner list from all league rosters
  const partners = useMemo(() => {
    if (!leagues || !userId) return []
    const seen = new Set<string>()
    const result: DmPartner[] = []
    for (const league of Object.values(leagues)) {
      for (const roster of league.rosters) {
        if (roster.user_id === userId) continue
        if (!roster.user_id || seen.has(roster.user_id)) continue
        seen.add(roster.user_id)
        result.push({
          user_id: roster.user_id,
          username: roster.username || `User ${roster.user_id.slice(0, 6)}`,
          avatar: roster.avatar,
        })
      }
    }
    return result.sort((a, b) => a.username.localeCompare(b.username))
  }, [leagues, userId])

  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return partners
    const q = search.toLowerCase()
    return partners.filter((p) => p.username.toLowerCase().includes(q))
  }, [partners, search])

  if (loading && partners.length === 0) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center p-6">
        <ActivityIndicator size="large" color="#60A5FA" />
        <Text className="text-gray-400 text-xs mt-3">Loading leagues...</Text>
      </View>
    )
  }

  if (partners.length === 0) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center p-6">
        <Text className="text-gray-400 text-sm">No league opponents found</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-gray-900">
      <View className="px-4 pt-3 pb-2">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search opponents..."
          placeholderTextColor="#6B7280"
          className="bg-gray-800 rounded-lg px-3 py-2 text-gray-100 text-sm border border-gray-700"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.user_id}
        renderItem={({ item }) => <DmCard partner={item} userId={userId} />}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          <Text className="text-gray-500 text-center p-5 text-sm">No matches</Text>
        }
      />
    </View>
  )
}
