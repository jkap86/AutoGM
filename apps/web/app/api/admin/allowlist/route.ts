import { NextRequest, NextResponse } from "next/server";

const GIST_ID = process.env.ALLOWLIST_GIST_ID || "5ffafe73e067c18d0b5ea440b0f9a04a";
const GIST_FILENAME = "allowlist.json";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function requireAdmin(req: NextRequest): string | NextResponse {
  const password = req.headers.get("x-admin-password");
  if (!password || !ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid admin credentials" }, { status: 403 });
  }
  return "admin";
}

async function fetchGistContent(): Promise<{ allowed_user_ids: string[] }> {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {},
  });
  if (!res.ok) throw new Error(`Failed to fetch gist: ${res.status}`);
  const gist = await res.json();
  const content = gist.files[GIST_FILENAME]?.content;
  if (!content) throw new Error("Gist file not found");
  return JSON.parse(content);
}

async function updateGistContent(data: { allowed_user_ids: string[] }): Promise<void> {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN not configured");
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(data, null, 2),
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Failed to update gist: ${res.status}`);
}

/** Fetch username from Sleeper API */
async function fetchSleeperUser(userId: string): Promise<{ user_id: string; display_name: string; avatar: string | null } | null> {
  try {
    const res = await fetch(`https://api.sleeper.app/v1/user/${userId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return { user_id: data.user_id, display_name: data.display_name, avatar: data.avatar };
  } catch {
    return null;
  }
}

// GET - Fetch current allowlist with usernames
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await fetchGistContent();
    // Fetch usernames for all IDs in parallel
    const users = await Promise.all(
      data.allowed_user_ids.map(async (id) => {
        const user = await fetchSleeperUser(id);
        return {
          user_id: id,
          display_name: user?.display_name ?? "Unknown",
          avatar: user?.avatar ?? null,
        };
      }),
    );
    return NextResponse.json({ users });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// POST - Add or remove users from the allowlist
// Body: { action: "add" | "remove", user_id: string }
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { action, user_id } = body ?? {};

    if (typeof action !== 'string' || (action !== 'add' && action !== 'remove')) {
      return NextResponse.json({ error: "action must be 'add' or 'remove'" }, { status: 400 });
    }
    if (typeof user_id !== 'string' || user_id.trim() === '') {
      return NextResponse.json({ error: "user_id must be a non-empty string" }, { status: 400 });
    }

    const data = await fetchGistContent();

    if (action === "add") {
      if (data.allowed_user_ids.includes(user_id)) {
        return NextResponse.json({ error: "User already in allowlist" }, { status: 409 });
      }
      data.allowed_user_ids.push(user_id);
    } else {
      const idx = data.allowed_user_ids.indexOf(user_id);
      if (idx === -1) {
        return NextResponse.json({ error: "User not in allowlist" }, { status: 404 });
      }
      data.allowed_user_ids.splice(idx, 1);
    }

    await updateGistContent(data);

    // Return updated user info
    const user = await fetchSleeperUser(user_id);
    return NextResponse.json({
      success: true,
      user: { user_id, display_name: user?.display_name ?? "Unknown", avatar: user?.avatar ?? null },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
