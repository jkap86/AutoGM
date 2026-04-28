import { gqlRequest } from '../client'
import type { ProposeTradeVars, ProposeTradeResult } from './types'

const MUTATION = `
  mutation propose_trade(
    $league_id: String!,
    $draft_picks: [String]!,
    $k_adds: [String],
    $v_adds: [Int],
    $k_drops: [String],
    $v_drops: [Int],
    $waiver_budget: [String]!,
    $reject_transaction_id: String,
    $reject_transaction_leg: Int,
    $expires_at: Int
  ) {
    propose_trade(
      league_id: $league_id,
      draft_picks: $draft_picks,
      k_adds: $k_adds,
      v_adds: $v_adds,
      k_drops: $k_drops,
      v_drops: $v_drops,
      waiver_budget: $waiver_budget,
      reject_transaction_id: $reject_transaction_id,
      reject_transaction_leg: $reject_transaction_leg,
      expires_at: $expires_at
    ) {
      transaction_id status league_id leg consenter_ids roster_ids
      adds drops draft_picks waiver_budget player_map metadata
      created creator status_updated type settings
    }
  }
`

export async function proposeTrade(
  vars: ProposeTradeVars
): Promise<ProposeTradeResult> {
  return gqlRequest<ProposeTradeResult>(
    MUTATION,
    {
      league_id: vars.league_id,
      draft_picks: vars.draft_picks ?? [],
      k_adds: vars.k_adds,
      v_adds: vars.v_adds,
      k_drops: vars.k_drops,
      v_drops: vars.v_drops,
      waiver_budget: vars.waiver_budget ?? [],
      reject_transaction_id: vars.reject_transaction_id,
      reject_transaction_leg: vars.reject_transaction_leg,
      expires_at: vars.expires_at,
    },
    {
      operationName: 'propose_trade',
      headers: {
        Referer: `https://sleeper.com/leagues/${vars.league_id}`,
      },
    }
  )
}
