'use client'

import { useState } from 'react'
import { Session, useAuth } from '../contexts/auth-context'

export function useSleeperLogin() {
  const { session, setSession, setAccessAllowed } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.ipc.invoke<Session>('login')
      setSession(data)

      if (data?.user_id) {
        const { allowed } = await window.ipc.invoke<{ allowed: boolean }>(
          'access:check',
          { user_id: data.user_id },
        )
        setAccessAllowed(allowed)
      }

      return data
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { login, loading, result: session, error }
}
