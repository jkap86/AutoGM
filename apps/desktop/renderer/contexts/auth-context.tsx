'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Session = {
  token: string | null
  user_id: string | null
}

type AuthContextValue = {
  session: Session | null
  setSession: (session: Session | null) => void
  clearSession: () => void
  accessAllowed: boolean | null
  setAccessAllowed: (v: boolean | null) => void
  restoring: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null)
  const [restoring, setRestoring] = useState(true)

  // Attempt to restore a persisted session on mount
  useEffect(() => {
    window.ipc
      .invoke<Session | null>('session:restore')
      .then(async (saved) => {
        if (saved?.token && saved?.user_id) {
          setSession(saved)
          const { allowed } = await window.ipc.invoke<{ allowed: boolean }>(
            'access:check',
            { user_id: saved.user_id },
          )
          setAccessAllowed(allowed)
        }
      })
      .catch(() => {
        // no saved session — user will need to log in
      })
      .finally(() => setRestoring(false))
  }, [])

  const clearSession = () => {
    setSession(null)
    setAccessAllowed(null)
  }

  return (
    <AuthContext.Provider value={{ session, setSession, clearSession, accessAllowed, setAccessAllowed, restoring }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
