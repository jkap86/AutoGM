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
    const res = await fetch(`https://api.sleeper.app/v1/user/${username}`);
    if (!res.ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const data = await res.json();
    return NextResponse.json({
      user_id: data.user_id,
      display_name: data.display_name,
      avatar: data.avatar,
    });
  } catch {
    return NextResponse.json({ error: "Failed to resolve user" }, { status: 500 });
  }
}
