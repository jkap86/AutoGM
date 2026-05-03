import { gqlRequest } from '../client'
import type { MakeDraftPickVars, MakeDraftPickResult } from './types'

const MUTATION = `
  mutation make_pick(
    $draft_id: Snowflake!,
    $player_id: String!
  ) {
    make_pick(
      draft_id: $draft_id,
      player_id: $player_id
    ) {
      draft_id pick_no player_id picked_by round draft_slot is_keeper metadata
    }
  }
`

export async function makeDraftPick(
  vars: MakeDraftPickVars
): Promise<MakeDraftPickResult> {
  return gqlRequest<MakeDraftPickResult>(
    MUTATION,
    {
      draft_id: vars.draft_id,
      player_id: vars.player_id,
    },
    {
      operationName: 'make_pick',
    }
  )
}
