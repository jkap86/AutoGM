type Session = {
  token: string
  user_id: string
}

let currentSession: Session | null = null

export function setSession(session: Session | null) {
  currentSession = session
}

export function getSession(): Session | null {
  return currentSession
}

export function getToken(): string | null {
  return currentSession?.token ?? null
}

export function clearSession() {
  currentSession = null
}
