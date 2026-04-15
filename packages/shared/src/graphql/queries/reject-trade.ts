import { gqlRequest } from "../client";
import type { RejectTradeVars, RejectTradeResult } from "./types";

const MUTATION = `
  mutation reject_trade(
    $league_id: String!, $transaction_id: String!, $leg: Int!
  ) {
    reject_trade(
      league_id: $league_id, transaction_id: $transaction_id, leg: $leg
    ) {
      transaction_id status league_id leg consenter_ids roster_ids
      adds drops draft_picks waiver_budget player_map metadata
      created creator status_updated type settings
    }
  }
`;

export async function rejectTrade(
  vars: RejectTradeVars,
): Promise<RejectTradeResult> {
  return gqlRequest<RejectTradeResult>(MUTATION, vars, {
    operationName: "reject_trade",
    headers: { Referer: `https://sleeper.com/leagues/${vars.league_id}` },
  });
}
