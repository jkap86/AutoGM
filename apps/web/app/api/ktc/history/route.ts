import { NextRequest, NextResponse } from "next/server";
import { fetchKtcHistory } from "@autogm/shared";
import { getPool } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const playerIds = req.nextUrl.searchParams.get("playerIds");
  if (!playerIds) {
    return NextResponse.json(
      { error: "Missing ?playerIds= parameter (comma-separated)" },
      { status: 400 },
    );
  }

  try {
    const days = parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10);
    const ids = playerIds.split(",").filter(Boolean);

    const data = await fetchKtcHistory(getPool(), ids, days);
    return NextResponse.json(data);
  } catch (e) {
    console.error("GET /api/ktc/history error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
