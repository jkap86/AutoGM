import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import type { Message } from '@autogm/shared'
import { mobileDataClient } from '../data-client'

const REACTION_QUICK_EMOJIS = ['👍', '🔥', '😂', '❤️', '💀', '👀']

export function MessageBubble({
  msg,
  isMe,
  userId,
  parentId,
}: {
  msg: Message
  isMe: boolean
  userId: string
  parentId: string
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [localReactions, setLocalReactions] = useState<Record<string, number> | null>(null)
  const [localUserReactions, setLocalUserReactions] = useState<string[] | null>(null)

  const reactions = localReactions ?? ((msg.reactions ?? {}) as Record<string, number>)
  const userReactions = localUserReactions ?? ((msg.user_reactions ?? []) as string[])
  const reactionEntries = Object.entries(reactions).filter(([, count]) => count > 0)

  const toggleReaction = useCallback(async (emoji: string) => {
    const hasReacted = userReactions.includes(emoji)

    // Optimistic update
    const newReactions = { ...reactions }
    const newUserReactions = [...userReactions]
    if (hasReacted) {
      newReactions[emoji] = Math.max(0, (newReactions[emoji] ?? 1) - 1)
      const idx = newUserReactions.indexOf(emoji)
      if (idx >= 0) newUserReactions.splice(idx, 1)
    } else {
      newReactions[emoji] = (newReactions[emoji] ?? 0) + 1
      newUserReactions.push(emoji)
    }
    setLocalReactions(newReactions)
    setLocalUserReactions(newUserReactions)
    setShowReactionPicker(false)

    try {
      await mobileDataClient.graphql(
        hasReacted ? 'deleteReaction' : 'createReaction',
        { message_id: msg.message_id, parent_id: parentId, reaction: emoji },
      )
    } catch (e) {
      // Revert on error
      setLocalReactions(null)
      setLocalUserReactions(null)
      console.warn('[reaction]', e instanceof Error ? e.message : e)
    }
  }, [msg.message_id, parentId, reactions, userReactions])

  return (
    <View className={`mb-1.5 ${isMe ? 'items-end' : 'items-start'}`}>
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => setShowReactionPicker((p) => !p)}
        delayLongPress={300}
      >
        <View className={`max-w-[75%] rounded-xl px-2.5 py-1.5 ${isMe ? 'bg-blue-600/20' : 'bg-gray-700'}`}>
          <Text className="text-gray-500 text-[10px] font-semibold">{msg.author_display_name}</Text>
          {msg.text ? <Text className="text-gray-100 text-[13px]">{msg.text}</Text> : null}
        </View>
      </TouchableOpacity>

      {/* Reaction display */}
      {reactionEntries.length > 0 && (
        <View className="flex-row flex-wrap gap-1 mt-0.5 px-1">
          {reactionEntries.map(([emoji, count]) => {
            const isMine = userReactions.includes(emoji)
            return (
              <TouchableOpacity
                key={emoji}
                onPress={() => toggleReaction(emoji)}
                className={`flex-row items-center rounded-full px-1.5 py-0.5 ${
                  isMine ? 'bg-blue-600/30 border border-blue-500/40' : 'bg-gray-700/60 border border-gray-600/30'
                }`}
              >
                <Text style={{ fontSize: 12 }}>{emoji}</Text>
                {count > 1 && <Text className={`text-[10px] ml-0.5 font-medium ${isMine ? 'text-blue-400' : 'text-gray-400'}`}>{count}</Text>}
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* Reaction picker */}
      {showReactionPicker && (
        <View className="flex-row gap-1 mt-1 bg-gray-800 border border-gray-700 rounded-full px-2 py-1">
          {REACTION_QUICK_EMOJIS.map((emoji) => (
            <TouchableOpacity key={emoji} onPress={() => toggleReaction(emoji)} className="px-0.5">
              <Text style={{ fontSize: 18 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}
