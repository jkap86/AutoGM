import { NextRequest, NextResponse } from "next/server";
import { fetchAdp } from "@autogm/shared";
import type { AdpFilters } from "@autogm/shared";
import { getPool } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const filters: AdpFilters = await req.json().catch(() => ({}));
    if (filters.scoringFilters) filters.scoringFilters = filters.scoringFilters.slice(0, 20);
    if (filters.settingsFilters) filters.settingsFilters = filters.settingsFilters.slice(0, 20);
    if (filters.rosterSlotFilters) filters.rosterSlotFilters = filters.rosterSlotFilters.slice(0, 20);
    if (filters.leagueTypes) filters.leagueTypes = filters.leagueTypes.slice(0, 20);
    if (filters.bestBall) filters.bestBall = filters.bestBall.slice(0, 20);
    filters.minDrafts = Math.min(100, Math.max(1, filters.minDrafts ?? 2));
    const data = await fetchAdp(getPool(), filters);
    return NextResponse.json(data);
  } catch (e) {
    console.error("POST /api/adp/fetch error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
