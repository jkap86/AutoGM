import { gqlRequest } from "../client";
import type { LeagueTransactionsVars, LeagueTransactionsResult } from "./types";

const QUERY = `
  query league_transactions(
    $league_id: String!, $status: String, $type: String,
    $limit: Int, $roster_id: Int
  ) {
    league_transactions(
      league_id: $league_id, status: $status, type: $type,
      limit: $limit, roster_id: $roster_id
    ) {
      transaction_id status type league_id leg created creator status_updated
      roster_ids consenter_ids adds drops draft_picks waiver_budget
      player_map metadata settings
    }
  }
`;

export async function leagueTransactions(
  vars: LeagueTransactionsVars,
): Promise<LeagueTransactionsResult> {
  return gqlRequest<LeagueTransactionsResult>(QUERY, vars, {
    operationName: "league_transactions",
  });
}
