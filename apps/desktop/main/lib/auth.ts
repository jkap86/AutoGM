import Store from "electron-store";
import { checkAccess } from "./access";

export type Session = {
  token: string
  user_id: string
}

type AuthStoreSchema = {
  session: Session | null
}

let _store: Store<AuthStoreSchema> | null = null

function getStore(): Store<AuthStoreSchema> {
  if (!_store) {
    _store = new Store<AuthStoreSchema>({
      name: "auth",
      defaults: { session: null },
    })
  }
  return _store
}

let currentSession: Session | null = null

export function setSession(session: Session | null) {
  currentSession = session
  getStore().set("session", session)
}

export function getSession(): Session | null {
  return currentSession
}

export function getToken(): string | null {
  return currentSession?.token ?? null
}

export function clearSession() {
  currentSession = null
  getStore().set("session", null)
}

/** Restore session from disk (called once at startup). */
export function restoreSession(): Session | null {
  const saved = getStore().get("session")
  if (saved?.token && saved?.user_id) {
    currentSession = saved
    return saved
  }
  return null
}

/**
 * Verifies the current session exists and the user is on the allowlist.
 * Throws if unauthorized. Returns the validated session.
 */
export async function requireAccess(): Promise<Session> {
  const session = currentSession
  if (!session?.user_id) {
    throw new Error("Not authenticated")
  }
  const { allowed } = await checkAccess(session.user_id)
  if (!allowed) {
    throw new Error("Access denied")
  }
  return session
}
