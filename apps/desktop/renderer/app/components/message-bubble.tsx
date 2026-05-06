'use client'

import { useState, useCallback, type ReactNode } from 'react'
import type { Message } from '@autogm/shared'

const REACTION_QUICK_EMOJIS = ['👍', '🔥', '😂', '❤️', '💀', '👀']

export function MessageBubble({
  msg,
  isUser,
  parentId,
  children,
}: {
  msg: Message
  isUser: boolean
  parentId: string
  children: ReactNode
}) {
  const [showPicker, setShowPicker] = useState(false)
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
    setShowPicker(false)

    try {
      await window.ipc.invoke('graphql', {
        name: hasReacted ? 'deleteReaction' : 'createReaction',
        vars: { message_id: msg.message_id, parent_id: parentId, reaction: emoji },
      })
    } catch (e) {
      // Revert on error
      setLocalReactions(null)
      setLocalUserReactions(null)
      console.warn('[reaction]', e instanceof Error ? e.message : e)
    }
  }, [msg.message_id, parentId, reactions, userReactions])

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group relative`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-1.5 ${isUser ? 'bg-blue-600/20' : 'bg-gray-700/60'} cursor-pointer`}
        onDoubleClick={() => setShowPicker((p) => !p)}
      >
        {children}
      </div>

      {/* Reaction display */}
      {reactionEntries.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5 px-1">
          {reactionEntries.map(([emoji, count]) => {
            const isMine = userReactions.includes(emoji)
            return (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition ${
                  isMine
                    ? 'bg-blue-600/30 border border-blue-500/40 hover:bg-blue-600/40'
                    : 'bg-gray-700/60 border border-gray-600/30 hover:bg-gray-600/40'
                }`}
              >
                <span>{emoji}</span>
                {count > 1 && <span className={`text-[10px] font-medium ${isMine ? 'text-blue-400' : 'text-gray-400'}`}>{count}</span>}
              </button>
            )
          })}
          <button
            onClick={() => setShowPicker((p) => !p)}
            className="flex items-center rounded-full px-1.5 py-0.5 bg-gray-700/40 border border-gray-600/20 hover:bg-gray-600/40 transition text-gray-500 hover:text-gray-300"
          >
            <span className="text-[10px]">+</span>
          </button>
        </div>
      )}

      {/* Hover reaction button */}
      {reactionEntries.length === 0 && (
        <button
          onClick={() => setShowPicker((p) => !p)}
          className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition rounded-full bg-gray-800 border border-gray-700 px-1.5 py-0.5 text-gray-500 hover:text-gray-300 text-[10px]"
        >
          😊
        </button>
      )}

      {/* Reaction picker */}
      {showPicker && (
        <div className="flex gap-1 mt-1 bg-gray-800 border border-gray-700 rounded-full px-2 py-1 shadow-lg z-10">
          {REACTION_QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => toggleReaction(emoji)}
              className="hover:scale-125 transition-transform px-0.5"
            >
              <span className="text-lg">{emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
