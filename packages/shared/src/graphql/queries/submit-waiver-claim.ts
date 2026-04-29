import { gqlRequest } from '../client'
import type { SubmitWaiverClaimVars, SubmitWaiverClaimResult } from './types'

const MUTATION = `
  mutation submit_waiver_claim(
    $league_id: Snowflake!,
    $k_adds: [String],
    $v_adds: [Int],
    $k_drops: [String],
    $v_drops: [Int],
    $k_settings: [String],
    $v_settings: [Int]
  ) {
    submit_waiver_claim(
      league_id: $league_id,
      k_adds: $k_adds,
      v_adds: $v_adds,
      k_drops: $k_drops,
      v_drops: $v_drops,
      k_settings: $k_settings,
      v_settings: $v_settings
    ) {
      transaction_id status type adds drops waiver_budget settings metadata
      created creator status_updated league_id roster_ids
    }
  }
`

export async function submitWaiverClaim(
  vars: SubmitWaiverClaimVars
): Promise<SubmitWaiverClaimResult> {
  return gqlRequest<SubmitWaiverClaimResult>(
    MUTATION,
    {
      league_id: vars.league_id,
      k_adds: vars.k_adds,
      v_adds: vars.v_adds,
      k_drops: vars.k_drops ?? [],
      v_drops: vars.v_drops ?? [],
      k_settings: vars.k_settings ?? [],
      v_settings: vars.v_settings ?? [],
    },
    {
      operationName: 'submit_waiver_claim',
      headers: {
        Referer: `https://sleeper.com/leagues/${vars.league_id}`,
      },
    }
  )
}
