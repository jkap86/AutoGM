import { NextRequest, NextResponse } from "next/server";
import { fetchAdpStats } from "@autogm/shared";
import type { AdpFilters } from "@autogm/shared";
import { getPool } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const filters: AdpFilters = await req.json().catch(() => ({}));
  const data = await fetchAdpStats(getPool(), filters);
  return NextResponse.json(data);
}
