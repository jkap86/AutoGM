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

  try {
    const data = await fetchOpponentDrafts(getPool(), userId);
    return NextResponse.json(data);
  } catch (e) {
    console.error("GET /api/opponent/drafts error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
