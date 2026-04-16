import { gqlRequest } from "../client";
import type {
  LeaguePlayersVars,
  LeaguePlayersResult,
} from "./types";

const QUERY = `
  query league_players($league_id: String!) {
    league_players(league_id: $league_id) {
      player_id
      league_id
      metadata
      settings
    }
  }
`;

export async function leaguePlayers(
  vars: LeaguePlayersVars,
): Promise<LeaguePlayersResult> {
  return gqlRequest<LeaguePlayersResult>(QUERY, vars, {
    operationName: "league_players",
  });
}
