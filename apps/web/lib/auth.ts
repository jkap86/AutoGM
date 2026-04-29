import { NextRequest, NextResponse } from "next/server";

const ALLOWLIST_URL = process.env.ALLOWLIST_URL;
const DESKTOP_API_KEY = process.env.DESKTOP_API_KEY;
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { userIds: Set<string>; fetchedAt: number } | null = null;

async function fetchAllowlist(): Promise<Set<string>> {
  if (!ALLOWLIST_URL) {
    throw new Error("ALLOWLIST_URL is not set");
  }
  const res = await fetch(ALLOWLIST_URL);
  if (!res.ok) throw new Error(`Allowlist fetch failed: ${res.status}`);
  const json: { allowed_user_ids: string[] } = await res.json();
  return new Set(json.allowed_user_ids);
}

async function isAllowed(userId: string): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.userIds.has(userId);
  }
  try {
    const userIds = await fetchAllowlist();
    cache = { userIds, fetchedAt: now };
    return userIds.has(userId);
  } catch {
    if (cache) return cache.userIds.has(userId);
    return false;
  }
}

/**
 * Validates the x-user-id header against the allowlist.
 * Returns the user_id if authorized, or a 401/403 NextResponse if not.
 */
/**
 * Validates the x-user-id header against the allowlist.
 * Also validates x-desktop-api-key if DESKTOP_API_KEY is configured.
 * Returns the user_id if authorized, or a 401/403 NextResponse if not.
 */
export async function requireAuth(
  req: NextRequest,
): Promise<string | NextResponse> {
  // Validate desktop API key when configured
  if (DESKTOP_API_KEY) {
    const apiKey = req.headers.get("x-desktop-api-key");
    if (apiKey !== DESKTOP_API_KEY) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
  }

  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json(
      { error: "Missing x-user-id header" },
      { status: 401 },
    );
  }
  const allowed = await isAllowed(userId);
  if (!allowed) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return userId;
}
