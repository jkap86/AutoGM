import { NextRequest, NextResponse } from "next/server";
import { fetchKtcByDate } from "@autogm/shared";
import { getPool } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json(
      { error: "Missing ?date= parameter" },
      { status: 400 },
    );
  }

  const data = await fetchKtcByDate(getPool(), date);
  return NextResponse.json(data);
}
