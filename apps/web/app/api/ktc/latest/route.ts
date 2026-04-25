import { NextRequest, NextResponse } from "next/server";
import { fetchKtcLatest } from "@sleepier/shared";
import { getPool } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const data = await fetchKtcLatest(getPool());
  return NextResponse.json(data);
}
