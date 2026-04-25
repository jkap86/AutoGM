import type { Pool } from "pg";

export type AdpFilters = {
  startDate?: string | null;
  endDate?: string | null;
  draftType?: "snake" | "auction" | "linear" | null;
  leagueTypes?: number[];
  bestBall?: number[];
  season?: string | null;
  scoringFilters?: { key: string; operator: string; value: number }[];
  settingsFilters?: { key: string; operator: string; value: number }[];
  rosterSlotFilters?: { position: string; operator: string; count: number }[];
  minDrafts?: number;
};

export type AdpRow = {
  player_id: string;
  adp: number;
  min_pick: number;
  max_pick: number;
  stdev: number | null;
  n_drafts: number;
  n_auctions: number;
  avg_pct: number | null;
  min_pct: number | null;
  max_pct: number | null;
};

function buildQuery(filters: AdpFilters): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const conditions: string[] = ["d.status = 'complete'"];

  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.startDate) {
    conditions.push(
      `d.start_time >= EXTRACT(EPOCH FROM ${addParam(filters.startDate)}::timestamp) * 1000`,
    );
  }
  if (filters.endDate) {
    conditions.push(
      `d.start_time <= EXTRACT(EPOCH FROM ${addParam(filters.endDate)}::timestamp) * 1000`,
    );
  }
  if (filters.draftType) {
    conditions.push(`d.type = ${addParam(filters.draftType)}`);
  }
  if (filters.season) {
    conditions.push(`d.season = ${addParam(filters.season)}`);
  }
  if (
    filters.leagueTypes &&
    filters.leagueTypes.length > 0 &&
    filters.leagueTypes.length < 3
  ) {
    const placeholders = filters.leagueTypes.map((v) => addParam(v)).join(",");
    conditions.push(`(l.settings->>'type')::int IN (${placeholders})`);
  }
  if (
    filters.bestBall &&
    filters.bestBall.length > 0 &&
    filters.bestBall.length < 2
  ) {
    const placeholders = filters.bestBall.map((v) => addParam(v)).join(",");
    conditions.push(
      `COALESCE((l.settings->>'best_ball')::int, 0) IN (${placeholders})`,
    );
  }

  for (const f of filters.scoringFilters ?? []) {
    const op = f.operator === ">" ? ">" : f.operator === "<" ? "<" : "=";
    conditions.push(
      `COALESCE((l.scoring_settings->>${addParam(f.key)})::float, 0) ${op} ${addParam(f.value)}`,
    );
  }
  for (const f of filters.settingsFilters ?? []) {
    const op = f.operator === ">" ? ">" : f.operator === "<" ? "<" : "=";
    conditions.push(
      `COALESCE((l.settings->>${addParam(f.key)})::int, 0) ${op} ${addParam(f.value)}`,
    );
  }
  for (const f of filters.rosterSlotFilters ?? []) {
    const op = f.operator === ">" ? ">" : f.operator === "<" ? "<" : "=";
    const posMatch =
      f.position === "STARTER"
        ? `pos != 'BN' AND pos != 'IR' AND pos != 'TAXI'`
        : `pos = ${addParam(f.position)}`;
    conditions.push(
      `(SELECT COUNT(*) FROM jsonb_array_elements_text(l.roster_positions) pos WHERE ${posMatch}) ${op} ${addParam(f.count)}`,
    );
  }

  const minDrafts = filters.minDrafts ?? 2;

  const sql = `
    SELECT
      dp.player_id,
      AVG(dp.pick_no)::float AS adp,
      MIN(dp.pick_no) AS min_pick,
      MAX(dp.pick_no) AS max_pick,
      STDDEV(dp.pick_no)::float AS stdev,
      COUNT(*)::int AS n_drafts,
      COUNT(
        CASE
          WHEN dp.amount IS NOT NULL AND NULLIF((d.settings->>'budget')::float, 0) IS NOT NULL
            THEN 1
        END
      )::int AS n_auctions,
      AVG(
        CASE
          WHEN dp.amount IS NOT NULL AND NULLIF((d.settings->>'budget')::float, 0) IS NOT NULL
            THEN dp.amount::float / (d.settings->>'budget')::float
          ELSE NULL
        END
      )::float AS avg_pct,
      MIN(
        CASE
          WHEN dp.amount IS NOT NULL AND NULLIF((d.settings->>'budget')::float, 0) IS NOT NULL
            THEN dp.amount::float / (d.settings->>'budget')::float
          ELSE NULL
        END
      )::float AS min_pct,
      MAX(
        CASE
          WHEN dp.amount IS NOT NULL AND NULLIF((d.settings->>'budget')::float, 0) IS NOT NULL
            THEN dp.amount::float / (d.settings->>'budget')::float
          ELSE NULL
        END
      )::float AS max_pct
    FROM draft_picks dp
    JOIN drafts d ON dp.draft_id = d.draft_id
    JOIN leagues l ON d.league_id = l.league_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY dp.player_id
    HAVING COUNT(*) >= ${addParam(minDrafts)}
    ORDER BY adp ASC
  `;

  return { sql, params };
}

function buildStatsConditions(filters: AdpFilters): {
  sql: string;
  params: unknown[];
} {
  const params: unknown[] = [];
  const conditions: string[] = ["d.status = 'complete'"];
  const addParam = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (filters.startDate)
    conditions.push(
      `d.start_time >= EXTRACT(EPOCH FROM ${addParam(filters.startDate)}::timestamp) * 1000`,
    );
  if (filters.endDate)
    conditions.push(
      `d.start_time <= EXTRACT(EPOCH FROM ${addParam(filters.endDate)}::timestamp) * 1000`,
    );
  if (filters.draftType)
    conditions.push(`d.type = ${addParam(filters.draftType)}`);
  if (filters.season)
    conditions.push(`d.season = ${addParam(filters.season)}`);
  if (
    filters.leagueTypes &&
    filters.leagueTypes.length > 0 &&
    filters.leagueTypes.length < 3
  ) {
    const ph = filters.leagueTypes.map((v) => addParam(v)).join(",");
    conditions.push(`(l.settings->>'type')::int IN (${ph})`);
  }
  if (
    filters.bestBall &&
    filters.bestBall.length > 0 &&
    filters.bestBall.length < 2
  ) {
    const ph = filters.bestBall.map((v) => addParam(v)).join(",");
    conditions.push(
      `COALESCE((l.settings->>'best_ball')::int, 0) IN (${ph})`,
    );
  }
  for (const f of filters.scoringFilters ?? []) {
    const op = f.operator === ">" ? ">" : f.operator === "<" ? "<" : "=";
    conditions.push(
      `COALESCE((l.scoring_settings->>${addParam(f.key)})::float, 0) ${op} ${addParam(f.value)}`,
    );
  }
  for (const f of filters.settingsFilters ?? []) {
    const op = f.operator === ">" ? ">" : f.operator === "<" ? "<" : "=";
    conditions.push(
      `COALESCE((l.settings->>${addParam(f.key)})::int, 0) ${op} ${addParam(f.value)}`,
    );
  }
  for (const f of filters.rosterSlotFilters ?? []) {
    const op = f.operator === ">" ? ">" : f.operator === "<" ? "<" : "=";
    const posMatch =
      f.position === "STARTER"
        ? `pos != 'BN' AND pos != 'IR' AND pos != 'TAXI'`
        : `pos = ${addParam(f.position)}`;
    conditions.push(
      `(SELECT COUNT(*) FROM jsonb_array_elements_text(l.roster_positions) pos WHERE ${posMatch}) ${op} ${addParam(f.count)}`,
    );
  }

  const sql = `
    SELECT COUNT(DISTINCT d.draft_id)::int AS n_drafts,
           COUNT(DISTINCT d.league_id)::int AS n_leagues
    FROM drafts d
    JOIN leagues l ON d.league_id = l.league_id
    WHERE ${conditions.join(" AND ")}
  `;
  return { sql, params };
}

export async function fetchAdp(
  pool: Pool,
  filters: AdpFilters = {},
): Promise<AdpRow[]> {
  const { sql, params } = buildQuery(filters);
  const result = await pool.query(sql, params);
  return result.rows;
}

export async function fetchAdpStats(
  pool: Pool,
  filters: AdpFilters = {},
): Promise<{ n_drafts: number; n_leagues: number }> {
  const { sql, params } = buildStatsConditions(filters);
  const result = await pool.query(sql, params);
  return result.rows[0] ?? { n_drafts: 0, n_leagues: 0 };
}
