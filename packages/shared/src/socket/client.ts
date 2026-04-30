/**
 * Sleeper WebSocket client — Phoenix Channels protocol (vsn 2.0.0).
 *
 * Sleeper runs two Phoenix socket endpoints (same auth, same protocol):
 *   - gateway:  wss://gateway.sleeper.com/socket/websocket  (chat, drafts, trades, notifications)
 *   - presence: wss://presence.sleeper.com/socket/websocket  (online status per league)
 *
 * Messages are JSON arrays: [join_ref, ref, topic, event, payload]
 *
 * Usage:
 *   const socket = createSleeperSocket({ getToken: () => myToken })
 *   socket.connect()
 *   socket.join('user:424024949334740992', (event, payload) => { ... })
 *   socket.join('draft:1353879306207494144', (event, payload) => { ... })
 */

export const SLEEPER_GATEWAY = 'wss://gateway.sleeper.com/socket/websocket'
export const SLEEPER_PRESENCE = 'wss://presence.sleeper.com/socket/websocket'

// ── Phoenix Channel message format ──────────────────────────────────

/** [join_ref, ref, topic, event, payload] */
export type PhxMessage = [string | null, string | null, string, string, unknown]

export type SocketStatus = 'disconnected' | 'connecting' | 'connected'

// ── Presence types ──────────────────────────────────────────────────

export type PresenceMeta = {
  device_type: string
  in_chat: boolean
  online_at: string
  is_bot: boolean
  display_name: string
  avatar: string
  phx_ref: string
  real_name: string | null
}

export type PresenceDiff = {
  joins: Record<string, { metas: PresenceMeta[] }>
  leaves: Record<string, { metas: PresenceMeta[] }>
}

// ── Gateway event payloads ──────────────────────────────────────────

export type PlayerPickedPayload = {
  draft_id: string
  pick_no: number
  player_id: string
  picked_by: string
  is_keeper: boolean | null
  reactions: unknown
  metadata: {
    player_id: string
    first_name: string
    last_name: string
    position: string
    team: string
    sport: string
    status: string
    years_exp: string
    [key: string]: unknown
  }
}

export type MessageCreatedPayload = {
  message_id: string
  parent_type: string
  parent_id: string
  author_id: string
  author_display_name: string
  author_avatar: string | null
  author_is_bot: boolean
  text: string
  text_map: unknown
  created: number
  attachment: unknown
  [key: string]: unknown
}

/** Convert a socket message_created payload to a Message object. */
export function messageFromSocket(p: MessageCreatedPayload) {
  return {
    message_id: p.message_id,
    parent_id: p.parent_id,
    parent_type: p.parent_type,
    author_id: p.author_id,
    author_display_name: p.author_display_name,
    author_avatar: p.author_avatar,
    author_is_bot: p.author_is_bot,
    author_real_name: (p.author_real_name as string | null) ?? null,
    author_role_id: (p.author_role_id as string | null) ?? null,
    client_id: (p.client_id as string) ?? '',
    text: p.text,
    text_map: p.text_map,
    created: p.created,
    attachment: p.attachment,
    pinned: (p.pinned as boolean) ?? false,
    reactions: p.reactions ?? null,
    user_reactions: p.user_reactions ?? null,
  }
}

export type MentionPayload = {
  message_id: string
  user_id: string
  unread: boolean
  parent_id: string
  metadata: {
    text: string
    parent_type: string
    league_id?: string
    name?: string
    author_id: string
    author_display_name: string
    author_avatar: string | null
    created: number
    [key: string]: unknown
  }
}

export type NotificationsPayload = {
  unread_mentions: number
}

export type ReadReceiptPayload = {
  user_id: string
  type: string
  last_read_id: string
  draft_id?: string
}

export type TypingPayload = {
  user_id: string
  name: string
  ts: number
}

// ── Topic helpers ───────────────────────────────────────────────────

export const SleeperTopics = {
  // Gateway topics
  user: (userId: string) => `user:${userId}`,
  league: (leagueId: string) => `league:${leagueId}`,
  dm: (dmId: string) => `dm:${dmId}`,
  draft: (draftId: string) => `draft:${draftId}`,
  // Presence topics
  userPresence: (userId: string) => `presence_presence:${userId}`,
  leaguePresence: (leagueId: string) => `presence_league:${leagueId}`,
  leagueVoice: (leagueId: string) => `presence_league_voice:${leagueId}`,
} as const

// ── Client ───────────────────────────────────────────────────────────

type TopicListener = (event: string, payload: unknown) => void
type Listener = (data: unknown) => void

export type SleeperSocketOptions = {
  /** Return the current bearer token (same one used for GraphQL). */
  getToken: () => string | null
  /** WebSocket endpoint (default: gateway). */
  endpoint?: string
  /** Auto-reconnect on close/error (default true). */
  autoReconnect?: boolean
  /** Reconnect delay in ms (default 3000, doubles each attempt up to 30s). */
  reconnectDelay?: number
  /** Called whenever connection status changes. */
  onStatusChange?: (status: SocketStatus) => void
}

export function createSleeperSocket(opts: SleeperSocketOptions) {
  const {
    getToken,
    endpoint = SLEEPER_GATEWAY,
    autoReconnect = true,
    reconnectDelay = 3_000,
    onStatusChange,
  } = opts

  let ws: WebSocket | null = null
  let status: SocketStatus = 'disconnected'
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let reconnectAttempts = 0
  let refCounter = 0

  const topicListeners = new Map<string, Set<TopicListener>>()
  const wildcardListeners = new Set<Listener>()
  const joinedTopics = new Set<string>()

  // ── Helpers ──────────────────────────────────────────────────────

  function nextRef() {
    return String(++refCounter)
  }

  function setStatus(next: SocketStatus) {
    status = next
    onStatusChange?.(next)
  }

  function scheduleReconnect() {
    if (!autoReconnect) return
    const delay = Math.min(reconnectDelay * 2 ** reconnectAttempts, 30_000)
    reconnectAttempts++
    reconnectTimer = setTimeout(() => connect(), delay)
  }

  function startHeartbeat() {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      sendRaw([null, nextRef(), 'phoenix', 'heartbeat', {}])
    }, 30_000)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function sendRaw(msg: PhxMessage) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  // ── Public API ───────────────────────────────────────────────────

  function connect() {
    if (ws) return

    const token = getToken()
    const params = new URLSearchParams({
      ...(token ? { token } : {}),
      device_type: 'web',
      vsn: '2.0.0',
    })
    const url = `${endpoint}?${params.toString()}`

    setStatus('connecting')
    ws = new WebSocket(url)

    ws.onopen = () => {
      reconnectAttempts = 0
      setStatus('connected')
      startHeartbeat()
      for (const topic of joinedTopics) {
        sendRaw([nextRef(), nextRef(), topic, 'phx_join', {}])
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg: PhxMessage = JSON.parse(
          typeof event.data === 'string' ? event.data : ''
        )
        const [, , topic, phxEvent, payload] = msg

        wildcardListeners.forEach((fn) => fn(msg))
        topicListeners.get(topic)?.forEach((fn) => fn(phxEvent, payload))
      } catch {
        // Non-JSON frame — ignore
      }
    }

    ws.onclose = () => {
      ws = null
      stopHeartbeat()
      setStatus('disconnected')
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    stopHeartbeat()
    reconnectAttempts = 0
    ws?.close()
    ws = null
    setStatus('disconnected')
  }

  /**
   * Join a Phoenix channel topic and listen for events.
   * Returns an unsubscribe function.
   */
  function join(topic: string, listener: TopicListener) {
    joinedTopics.add(topic)

    if (!topicListeners.has(topic)) {
      topicListeners.set(topic, new Set())
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendRaw([nextRef(), nextRef(), topic, 'phx_join', {}])
      }
    }

    topicListeners.get(topic)!.add(listener)

    return () => {
      topicListeners.get(topic)?.delete(listener)
      if (topicListeners.get(topic)?.size === 0) {
        topicListeners.delete(topic)
        joinedTopics.delete(topic)
        if (ws && ws.readyState === WebSocket.OPEN) {
          sendRaw([nextRef(), nextRef(), topic, 'phx_leave', {}])
        }
      }
    }
  }

  /** Send a custom event on a topic. */
  function push(topic: string, event: string, payload: unknown = {}) {
    sendRaw([null, nextRef(), topic, event, payload])
  }

  /** Listen to every raw Phoenix message. */
  function onAll(fn: Listener) {
    wildcardListeners.add(fn)
    return () => wildcardListeners.delete(fn)
  }

  function getStatus() {
    return status
  }

  return { connect, disconnect, join, push, onAll, getStatus }
}

export type SleeperSocket = ReturnType<typeof createSleeperSocket>
