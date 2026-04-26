import { NextRequest, NextResponse } from "next/server";
import { fetchOpponentDrafts } from "@autogm/shared";
import { getPool } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "Missing ?userId= parameter" },
      { status: 400 },
    );
  }

  const data = await fetchOpponentDrafts(getPool(), userId);
  return NextResponse.json(data);
}
