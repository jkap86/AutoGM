import { cached } from "../lib/cache";
import type { Allplayer } from "@autogm/shared";
import { getJson } from "./get-json";

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export async function fetchAllPlayers(): Promise<Allplayer[]> {
  return cached(["allplayers"], CACHE_TTL_MS, async () => {
    const players = await getJson<Record<string, Allplayer>>(
      "https://api.sleeper.app/v1/players/nfl",
    );
    return Object.values(players);
  });
}
