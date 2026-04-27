import { BROWSER_HEADERS } from '../browser-headers'

/**
 * Sleeper WebSocket client.
 *
 * The actual endpoint URL and message format need to be filled in after
 * capturing them from Sleeper's web app via Chrome DevTools (Network → WS).
 *
 * Usage:
 *   const socket = createSleeperSocket({ getToken: () => myToken })
 *   socket.on('trade_proposal', (data) => { ... })
 *   socket.connect()
 *   // later:
 *   socket.disconnect()
 */

// ── Placeholder: replace with actual endpoint from DevTools ──────────
// Open sleeper.com → DevTools → Network → WS → copy the wss:// URL
const DEFAULT_ENDPOINT = 'wss://TODO-capture-from-devtools.sleeper.com'

// ── Types ────────────────────────────────────────────────────────────

export type SleeperSocketEvent = string // narrow this once you know the event names

export type SleeperSocketMessage = {
  event: SleeperSocketEvent
  data: unknown
  [key: string]: unknown
}

export type SocketStatus = 'disconnected' | 'connecting' | 'connected'

type Listener = (data: unknown) => void

export type SleeperSocketOptions = {
  /** Return the current bearer token (same one used for GraphQL). */
  getToken: () => string | null
  /** Override the default WebSocket endpoint. */
  endpoint?: string
  /** Auto-reconnect on close/error (default true). */
  autoReconnect?: boolean
  /** Reconnect delay in ms (default 3000, doubles each attempt up to 30s). */
  reconnectDelay?: number
  /** Called whenever connection status changes. */
  onStatusChange?: (status: SocketStatus) => void
}

// ── Client ───────────────────────────────────────────────────────────

export function createSleeperSocket(opts: SleeperSocketOptions) {
  const {
    getToken,
    endpoint = DEFAULT_ENDPOINT,
    autoReconnect = true,
    reconnectDelay = 3_000,
    onStatusChange,
  } = opts

  let ws: WebSocket | null = null
  let status: SocketStatus = 'disconnected'
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  const listeners = new Map<string, Set<Listener>>()

  // ── Helpers ──────────────────────────────────────────────────────

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

  // ── Public API ───────────────────────────────────────────────────

  function connect() {
    if (ws) return

    const token = getToken()

    // Most browser WebSocket constructors only accept `protocols` as a
    // second arg — custom headers aren't supported in the browser.
    // If Sleeper requires auth via headers (likely), you'll need to
    // either:
    //   a) pass the token as a query param: `${endpoint}?token=${token}`
    //   b) send an auth message right after connecting
    //   c) use the `ws` npm package on Node/Electron which supports headers
    //
    // Adjust the line below once you know the auth mechanism.
    const url = token ? `${endpoint}?token=${encodeURIComponent(token)}` : endpoint

    setStatus('connecting')

    ws = new WebSocket(url)

    ws.onopen = () => {
      reconnectAttempts = 0
      setStatus('connected')

      // ── Option B: send auth message after connecting ──
      // Uncomment & adjust once you know the format:
      // if (token) {
      //   ws!.send(JSON.stringify({ event: 'auth', token }))
      // }
    }

    ws.onmessage = (event) => {
      try {
        const msg: SleeperSocketMessage = JSON.parse(
          typeof event.data === 'string' ? event.data : ''
        )
        emit(msg.event, msg.data)
        emit('*', msg) // wildcard: receive every message
      } catch {
        // Non-JSON frame — emit as raw
        emit('raw', event.data)
      }
    }

    ws.onclose = () => {
      ws = null
      setStatus('disconnected')
      scheduleReconnect()
    }

    ws.onerror = () => {
      // onerror is always followed by onclose, so reconnect happens there
      ws?.close()
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    reconnectAttempts = 0
    ws?.close()
    ws = null
    setStatus('disconnected')
  }

  function send(data: unknown) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Socket not connected')
    }
    ws.send(JSON.stringify(data))
  }

  function on(event: string, fn: Listener) {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event)!.add(fn)
    return () => off(event, fn)
  }

  function off(event: string, fn: Listener) {
    listeners.get(event)?.delete(fn)
  }

  function emit(event: string, data: unknown) {
    listeners.get(event)?.forEach((fn) => fn(data))
  }

  function getStatus() {
    return status
  }

  return { connect, disconnect, send, on, off, getStatus }
}

export type SleeperSocket = ReturnType<typeof createSleeperSocket>
