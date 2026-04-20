import pool from '../lib/db'

export type OpponentDraftPick = {
  player_id: string
  pick_no: number
  round: number
  draft_slot: number
  amount: number | null
  draft_id: string
  season: string
  league_id: string
  type: string
  teams: number
}

export async function fetchOpponentDrafts(userId: string): Promise<OpponentDraftPick[]> {
  const query = `
    SELECT
      dp.player_id,
      dp.pick_no,
      dp.round,
      dp.draft_slot,
      dp.amount,
      dp.draft_id,
      d.season,
      d.league_id,
      d.type,
      (SELECT COUNT(DISTINCT dp2.roster_id) FROM draft_picks dp2 WHERE dp2.draft_id = d.draft_id)::int AS teams
    FROM draft_picks dp
    JOIN drafts d ON d.draft_id = dp.draft_id
    WHERE dp.picked_by = $1
      AND d.status = 'complete'
    ORDER BY d.season DESC, dp.pick_no ASC
    LIMIT 200
  `
  const result = await pool.query(query, [userId])
  return result.rows
}
