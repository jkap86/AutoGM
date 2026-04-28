'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  createSleeperSocket,
  SLEEPER_GATEWAY,
  SLEEPER_PRESENCE,
  type SleeperSocket,
  type SocketStatus,
} from '@autogm/shared'
import { useAuth } from './auth-context'

type SocketContextValue = {
  gateway: SleeperSocket | null
  presence: SleeperSocket | null
  gatewayStatus: SocketStatus
  presenceStatus: SocketStatus
}

const SocketContext = createContext<SocketContextValue>({
  gateway: null,
  presence: null,
  gatewayStatus: 'disconnected',
  presenceStatus: 'disconnected',
})

export function SocketProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const token = session?.token ?? null

  const [gatewayStatus, setGatewayStatus] = useState<SocketStatus>('disconnected')
  const [presenceStatus, setPresenceStatus] = useState<SocketStatus>('disconnected')

  const gatewayRef = useRef<SleeperSocket | null>(null)
  const presenceRef = useRef<SleeperSocket | null>(null)

  useEffect(() => {
    if (!token) {
      gatewayRef.current?.disconnect()
      presenceRef.current?.disconnect()
      gatewayRef.current = null
      presenceRef.current = null
      setGatewayStatus('disconnected')
      setPresenceStatus('disconnected')
      return
    }

    const getToken = () => token

    const gw = createSleeperSocket({
      getToken,
      endpoint: SLEEPER_GATEWAY,
      onStatusChange: setGatewayStatus,
    })

    const pr = createSleeperSocket({
      getToken,
      endpoint: SLEEPER_PRESENCE,
      onStatusChange: setPresenceStatus,
    })

    gatewayRef.current = gw
    presenceRef.current = pr

    gw.connect()
    pr.connect()

    return () => {
      gw.disconnect()
      pr.disconnect()
      gatewayRef.current = null
      presenceRef.current = null
    }
  }, [token])

  return (
    <SocketContext.Provider
      value={{
        gateway: gatewayRef.current,
        presence: presenceRef.current,
        gatewayStatus,
        presenceStatus,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

/** Access the raw socket instances and their connection status. */
export function useSocketContext() {
  return useContext(SocketContext)
}

/**
 * Join a gateway topic and listen for events. Automatically joins on mount
 * and leaves on unmount.
 *
 * @example
 * useGatewayTopic(`user:${userId}`, (event, payload) => {
 *   if (event === 'mention') { ... }
 * })
 */
export function useGatewayTopic(
  topic: string | null,
  listener: (event: string, payload: unknown) => void,
) {
  const { gateway } = useSocketContext()
  const listenerRef = useRef(listener)
  listenerRef.current = listener

  useEffect(() => {
    if (!gateway || !topic) return
    const unsub = gateway.join(topic, (event, payload) => {
      listenerRef.current(event, payload)
    })
    return unsub
  }, [gateway, topic])
}

/**
 * Join a presence topic and listen for events.
 *
 * @example
 * usePresenceTopic(`presence_league:${leagueId}`, (event, payload) => {
 *   if (event === 'presence_diff') { ... }
 * })
 */
export function usePresenceTopic(
  topic: string | null,
  listener: (event: string, payload: unknown) => void,
) {
  const { presence } = useSocketContext()
  const listenerRef = useRef(listener)
  listenerRef.current = listener

  useEffect(() => {
    if (!presence || !topic) return
    const unsub = presence.join(topic, (event, payload) => {
      listenerRef.current(event, payload)
    })
    return unsub
  }, [presence, topic])
}
