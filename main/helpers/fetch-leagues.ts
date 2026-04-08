import Store from "electron-store";
import { getLeagueDetails } from "../lib/get-league-details";
import { League, LeagueDetailed, LeaguesPayload, User } from "../lib/types";

type LeaguesCache = {
  leagues: { [user_season: string]: LeaguesPayload };
};

const store = new Store<LeaguesCache>({
  name: "leagues-cache",
  defaults: { leagues: {} },
});

const CACHE_TTL_MS = 15 * 60 * 1000;
const BATCH_SIZE = 15;

export async function fetchLeagues({
  user_id,
  season,
}: {
  user_id: string;
  season: string;
}): Promise<LeaguesPayload> {
  const cacheKey = `${user_id}:${season}`;
  const cached = store.get("leagues")[cacheKey];

  if (cached && cached.updated_at > Date.now() - CACHE_TTL_MS) {
    return cached;
  }

  const [userData, leaguesData] = await Promise.all([
    await fetch(
      `https://api.sleeper.app/v1/user/${user_id}/leagues/nfl/${season}`,
    ),
    await fetch(
      `https://api.sleeper.app/v1/user/${user_id}/leagues/nfl/${season}`,
    ),
  ]);

  if (!userData.ok || !leaguesData.ok) {
    throw new Error(
      `Failed to fetch leagues: ${userData.status} ${leaguesData.status}`,
    );
  }

  const user = (await userData.json()) as User;
  const leagues = (await leaguesData.json()) as League[];

  const leaguesDetailed: Awaited<ReturnType<typeof getLeagueDetails>> = [];

  for (let i = 0; i < leagues.length; i += BATCH_SIZE) {
    const batch = await getLeagueDetails({
      leagues: leagues.slice(i, i + BATCH_SIZE),
      user_id,
    });
    leaguesDetailed.push(...batch);
  }

  const payload: LeaguesPayload = {
    user,
    leagues: Object.fromEntries(
      leaguesDetailed
        .filter((l) => l.user_roster?.players?.length > 0)
        .map((l): [string, LeagueDetailed] => [
          l.league_id,
          {
            ...l,
            index: leagues.findIndex((l2) => l.league_id === l2.league_id),
          },
        ]),
    ),
    updated_at: Date.now(),
  };

  store.set("leagues", { ...store.get("leagues"), [cacheKey]: payload });

  return payload;
}
