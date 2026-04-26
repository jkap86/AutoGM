import createLogger from "./logger";

const log = createLogger("access");

function getAllowlistUrl(): string | null {
  return process.env.ALLOWLIST_URL || null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type AllowlistCache = {
  userIds: Set<string>;
  fetchedAt: number;
};

let cache: AllowlistCache | null = null;

async function fetchAllowlist(url: string): Promise<Set<string>> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Allowlist fetch failed: ${res.status}`);
  }
  const json: { allowed_user_ids: string[] } = await res.json();
  return new Set(json.allowed_user_ids);
}

export async function checkAccess(
  userId: string,
): Promise<{ allowed: boolean }> {
  const url = getAllowlistUrl();
  if (!url) {
    // No allowlist configured — allow all users
    return { allowed: true };
  }

  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { allowed: cache.userIds.has(userId) };
  }

  try {
    const userIds = await fetchAllowlist(url);
    cache = { userIds, fetchedAt: now };
    const allowed = userIds.has(userId);
    log.info(`user ${userId} access=${allowed} (${userIds.size} on allowlist)`);
    return { allowed };
  } catch (err) {
    log.warn(
      "failed to fetch allowlist:",
      err instanceof Error ? err.message : err,
    );
    if (cache) {
      return { allowed: cache.userIds.has(userId) };
    }
    return { allowed: false };
  }
}
