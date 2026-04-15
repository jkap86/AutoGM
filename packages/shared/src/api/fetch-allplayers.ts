import { getJson } from "./get-json";
import type { Allplayer } from "../types";

export async function fetchAllPlayersUncached(): Promise<Allplayer[]> {
  const players = await getJson<Record<string, Allplayer>>(
    "https://api.sleeper.app/v1/players/nfl",
  );
  return Object.values(players);
}
