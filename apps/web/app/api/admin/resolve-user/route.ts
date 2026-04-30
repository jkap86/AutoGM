import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function GET(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (!password || !ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid admin credentials" }, { status: 403 });
  }

  const username = req.nextUrl.searchParams.get("username");
  if (!username) {
    return NextResponse.json({ error: "username param required" }, { status: 400 });
  }

  try {
    const res = await fetch("https://sleeper.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($prefix: String!) { search_users(prefix: $prefix) { user_id display_name avatar } }`,
        variables: { prefix: username },
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Search failed" }, { status: 502 });
    }
    const json = await res.json();
    const users = json.data?.search_users ?? [];
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
