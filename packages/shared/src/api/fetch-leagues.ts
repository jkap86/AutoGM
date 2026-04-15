import { getLeagueDetails } from "./get-league-details";
import { getJson } from "./get-json";
import type { League, LeagueDetailed, LeaguesPayload, User } from "../types";

export async function fetchLeaguesUncached({
  user_id,
  season,
}: {
  user_id: string;
  season: string;
}): Promise<LeaguesPayload> {
  const [user, leagues] = await Promise.all([
    getJson<User>(`https://api.sleeper.app/v1/user/${user_id}`),
    getJson<League[]>(
      `https://api.sleeper.app/v1/user/${user_id}/leagues/nfl/${season}`,
    ),
  ]);

  const leaguesDetailed = await getLeagueDetails({ leagues, user_id });

  return {
    user,
    leagues: Object.fromEntries(
      leaguesDetailed.map((l): [string, LeagueDetailed] => [
        l.league_id,
        {
          ...l,
          index: leagues.findIndex((l2) => l.league_id === l2.league_id),
        },
      ]),
    ),
    updated_at: Date.now(),
  };
}
