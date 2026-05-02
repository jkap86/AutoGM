import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  createSleeperSocket,
  SLEEPER_GATEWAY,
  type SleeperSocket,
  type SocketStatus,
} from '@autogm/shared'
import { useAuth } from '@autogm/shared/react'

type SocketContextValue = {
  gateway: SleeperSocket | null
  gatewayStatus: SocketStatus
}

const SocketContext = createContext<SocketContextValue>({
  gateway: null,
  gatewayStatus: 'disconnected',
})

export function SocketProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const token = session?.token ?? null

  const [gatewayStatus, setGatewayStatus] = useState<SocketStatus>('disconnected')
  const gatewayRef = useRef<SleeperSocket | null>(null)

  useEffect(() => {
    if (!token) {
      gatewayRef.current?.disconnect()
      gatewayRef.current = null
      setGatewayStatus('disconnected')
      return
    }

    const getToken = () => token

    const gw = createSleeperSocket({
      getToken,
      endpoint: SLEEPER_GATEWAY,
      onStatusChange: setGatewayStatus,
    })

    gatewayRef.current = gw
    gw.connect()

    return () => {
      gw.disconnect()
      gatewayRef.current = null
    }
  }, [token])

  return (
    <SocketContext.Provider value={{ gateway: gatewayRef.current, gatewayStatus }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocketContext() {
  return useContext(SocketContext)
}

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

export function useGatewayTopics(
  topics: string[],
  listener: (event: string, payload: unknown) => void,
) {
  const { gateway } = useSocketContext()
  const listenerRef = useRef(listener)
  listenerRef.current = listener

  // Stable key so useEffect only re-runs when topics actually change
  const topicsKey = topics.join('\0')

  useEffect(() => {
    if (!gateway || topics.length === 0) return
    const unsubs = topics.map((topic) =>
      gateway.join(topic, (event, payload) => {
        listenerRef.current(event, payload)
      }),
    )
    return () => unsubs.forEach((unsub) => unsub())
  }, [gateway, topicsKey]) // eslint-disable-line react-hooks/exhaustive-deps
}
