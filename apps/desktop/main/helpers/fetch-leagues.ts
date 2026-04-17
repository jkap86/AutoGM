import { cached } from "../lib/cache";
import { getLeagueDetails } from "../lib/get-league-details";
import type { League, LeagueDetailed, LeaguesPayload, User } from "@sleepier/shared";
import { getJson } from "./get-json";

const CACHE_TTL_MS = 0.05 * 60 * 1000;

export async function fetchLeagues({
  user_id,
  season,
}: {
  user_id: string;
  season: string;
}): Promise<LeaguesPayload> {
  return cached(["leagues", user_id, season], CACHE_TTL_MS, async () => {
    // Both endpoints are independent — fire them in parallel.
    // (No `await` inside the array literal — that would serialize them.)
    const [user, leagues] = await Promise.all([
      getJson<User>(`https://api.sleeper.app/v1/user/${user_id}`),
      getJson<League[]>(
        `https://api.sleeper.app/v1/user/${user_id}/leagues/nfl/${season}`,
      ),
    ]);

    // getLeagueDetails parallelizes per-league fetches and filters out
    // leagues where the user has no players, so no extra filter is needed.
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
  });
}
