import { NextRequest, NextResponse } from "next/server";
import { fetchKtcLatest } from "@autogm/shared";
import { getPool } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await fetchKtcLatest(getPool());
    return NextResponse.json(data);
  } catch (e) {
    console.error("GET /api/ktc/latest error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
