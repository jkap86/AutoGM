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

function encodeSession(session: Session): string {
  const json = JSON.stringify(session);

  if (safeStorage.isEncryptionAvailable()) {
    return `enc:${safeStorage.encryptString(json).toString("base64")}`;
  }

  return `plain:${json}`;
}

function decodeSession(value: unknown): Session | null {
  if (!value) return null;

  // Legacy plaintext object (electron-store v1 format)
  if (
    typeof value === "object" &&
    value !== null &&
    "token" in value &&
    "user_id" in value
  ) {
    return value as Session;
  }

  if (typeof value !== "string") return null;

  try {
    if (value.startsWith("enc:")) {
      const raw = value.slice(4);
      const decrypted = safeStorage.decryptString(Buffer.from(raw, "base64"));
      return JSON.parse(decrypted) as Session;
    }

    if (value.startsWith("plain:")) {
      return JSON.parse(value.slice(6)) as Session;
    }

    // Legacy raw JSON string fallback
    if (value.trim().startsWith("{")) {
      return JSON.parse(value) as Session;
    }

    // Legacy unprefixed encrypted base64 fallback
    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(value, "base64"));
      return JSON.parse(decrypted) as Session;
    }

    return null;
  } catch {
    return null;
  }
}

let currentSession: Session | null = null

export function setSession(session: Session | null) {
  currentSession = session
  if (session) {
    getStore().set("session", encodeSession(session))
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
  const saved = decodeSession(raw)
  if (saved?.token && saved?.user_id) {
    currentSession = saved

    // Re-encode legacy values with proper prefix
    if (typeof raw !== "string" || (!raw.startsWith("enc:") && !raw.startsWith("plain:"))) {
      getStore().set("session", encodeSession(saved))
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
