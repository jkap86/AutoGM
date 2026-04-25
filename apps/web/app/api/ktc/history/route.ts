import { NextRequest, NextResponse } from "next/server";
import { fetchKtcHistory } from "@sleepier/shared";
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

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10);
  const ids = playerIds.split(",").filter(Boolean);

  const data = await fetchKtcHistory(getPool(), ids, days);
  return NextResponse.json(data);
}
