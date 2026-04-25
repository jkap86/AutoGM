const ALLOWLIST_URL = process.env.EXPO_PUBLIC_ALLOWLIST_URL

const CACHE_TTL_MS = 5 * 60 * 1000
let cache: { userIds: Set<string>; fetchedAt: number } | null = null

async function fetchAllowlist(): Promise<Set<string>> {
  if (!ALLOWLIST_URL) {
    // No allowlist configured — allow all users
    return new Set<string>()
  }
  const res = await fetch(ALLOWLIST_URL)
  if (!res.ok) throw new Error(`Allowlist fetch failed: ${res.status}`)
  const json: { allowed_user_ids: string[] } = await res.json()
  return new Set(json.allowed_user_ids)
}

/**
 * Check if a user is on the allowlist.
 * Returns true if no ALLOWLIST_URL is configured (open access).
 */
export async function checkAccess(userId: string): Promise<boolean> {
  if (!ALLOWLIST_URL) return true

  const now = Date.now()
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.userIds.has(userId)
  }

  try {
    const userIds = await fetchAllowlist()
    cache = { userIds, fetchedAt: now }
    return userIds.has(userId)
  } catch {
    if (cache) return cache.userIds.has(userId)
    return false
  }
}
