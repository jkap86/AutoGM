import { gqlRequest } from '../client'
import type { CancelWaiverClaimVars, CancelWaiverClaimResult } from './types'

const MUTATION = `
  mutation cancel_waiver_claim(
    $league_id: Snowflake!,
    $transaction_id: Snowflake!
  ) {
    cancel_waiver_claim(
      league_id: $league_id,
      transaction_id: $transaction_id
    ) {
      transaction_id status type league_id
    }
  }
`

export async function cancelWaiverClaim(
  vars: CancelWaiverClaimVars
): Promise<CancelWaiverClaimResult> {
  return gqlRequest<CancelWaiverClaimResult>(
    MUTATION,
    vars,
    {
      operationName: 'cancel_waiver_claim',
      headers: {
        Referer: `https://sleeper.com/leagues/${vars.league_id}`,
      },
    }
  )
}
