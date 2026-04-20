import createLogger from "./logger";

const log = createLogger("access");

const ALLOWLIST_URL =
  process.env.ALLOWLIST_URL ||
  "https://gist.githubusercontent.com/OWNER/GIST_ID/raw/allowlist.json";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type AllowlistCache = {
  userIds: Set<string>;
  fetchedAt: number;
};

let cache: AllowlistCache | null = null;

async function fetchAllowlist(): Promise<Set<string>> {
  const res = await fetch(ALLOWLIST_URL);
  if (!res.ok) {
    throw new Error(`Allowlist fetch failed: ${res.status}`);
  }
  const json: { allowed_user_ids: string[] } = await res.json();
  return new Set(json.allowed_user_ids);
}

export async function checkAccess(
  userId: string,
): Promise<{ allowed: boolean }> {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { allowed: cache.userIds.has(userId) };
  }

  try {
    const userIds = await fetchAllowlist();
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
