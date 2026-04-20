'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

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
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null)

  const clearSession = () => {
    setSession(null)
    setAccessAllowed(null)
  }

  return (
    <AuthContext.Provider value={{ session, setSession, clearSession, accessAllowed, setAccessAllowed }}>
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
