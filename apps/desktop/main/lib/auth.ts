import Store from "electron-store";
import { safeStorage } from "electron";
import { checkAccess } from "./access";

export type Session = {
  token: string
  user_id: string
}

type AuthStoreSchema = {
  /** Encrypted session blob (base64), or legacy plaintext Session. */
  session: string | Session | null
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

function encryptSession(session: Session): string {
  const json = JSON.stringify(session);
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(json).toString("base64");
  }
  // Fallback: store as plaintext JSON string (better than nothing)
  return json;
}

function decryptSession(value: string | Session | null): Session | null {
  if (!value) return null;

  // Legacy plaintext object from before encryption migration
  if (typeof value === "object" && "token" in value && "user_id" in value) {
    return value as Session;
  }

  if (typeof value !== "string") return null;

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(value, "base64"));
      return JSON.parse(decrypted) as Session;
    }
    // Fallback: try parsing as plain JSON
    return JSON.parse(value) as Session;
  } catch {
    return null;
  }
}

let currentSession: Session | null = null

export function setSession(session: Session | null) {
  currentSession = session
  if (session) {
    getStore().set("session", encryptSession(session))
  } else {
    getStore().set("session", null)
  }
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
  const raw = getStore().get("session")
  const saved = decryptSession(raw)
  if (saved?.token && saved?.user_id) {
    currentSession = saved

    // Re-encrypt legacy plaintext sessions
    if (typeof raw === "object" && raw !== null && "token" in raw) {
      getStore().set("session", encryptSession(saved))
    }

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
