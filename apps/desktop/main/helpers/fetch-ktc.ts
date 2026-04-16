import pool from '../lib/db'

export type KtcData = {
  latest_date: string
  last_updated: string
  player_values: Record<string, number>
}

export type KtcHistory = {
  player_id: string
  date: string
  value: number
  overall_rank: number | null
  position_rank: number | null
}[]

export async function fetchKtcLatest(): Promise<KtcData> {
  const query = `
    WITH latest AS (
      SELECT MAX(date) AS latest_date,
             MAX(updated_at) AS last_updated
      FROM ktc_dynasty
      WHERE date = (SELECT MAX(date) FROM ktc_dynasty)
    )
    SELECT latest.latest_date,
           latest.last_updated,
           jsonb_object_agg(k.player_id, k.value) AS player_values
    FROM latest, ktc_dynasty k
    WHERE k.date = latest.latest_date
    GROUP BY latest.latest_date, latest.last_updated;`

  const result = await pool.query(query)
  return result.rows[0] ?? { latest_date: '', last_updated: '', player_values: {} }
}

// Returns { latest_date, player_values } for the nearest available date on or before the requested date.
export async function fetchKtcByDate(date: string): Promise<KtcData> {
  const query = `
    WITH target AS (
      SELECT MAX(date) AS d FROM ktc_dynasty WHERE date <= $1::date
    )
    SELECT target.d AS latest_date,
           MAX(k.updated_at) AS last_updated,
           jsonb_object_agg(k.player_id, k.value) AS player_values
    FROM target, ktc_dynasty k
    WHERE k.date = target.d
    GROUP BY target.d;`

  const result = await pool.query(query, [date])
  return result.rows[0] ?? { latest_date: '', last_updated: '', player_values: {} }
}

export async function fetchKtcHistory(playerIds: string[], days = 90): Promise<KtcHistory> {
  if (playerIds.length === 0) return []

  const query = `
    SELECT player_id, date, value, overall_rank, position_rank
    FROM ktc_dynasty
    WHERE player_id = ANY($1)
      AND date >= CURRENT_DATE - $2::int
    ORDER BY date ASC`

  const result = await pool.query(query, [playerIds, days])
  return result.rows
}
