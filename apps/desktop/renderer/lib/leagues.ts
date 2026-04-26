import type {
  DraftpickDetailed,
  LeagueDetailed,
  Leaguemates,
  PickShares,
  PlayerShares,
} from "@autogm/shared";

export function getPickId(draftpick: DraftpickDetailed): string {
  if (draftpick.order !== null) {
    return `${draftpick.season} ${draftpick.round}.${draftpick.order.toLocaleString(
      "en-US",
      { minimumIntegerDigits: 2 },
    )}`;
  }
  return `${draftpick.season} Round ${draftpick.round}`;
}

// Walks every roster in every league and produces three indexes:
//   - player_shares: who owns each player across the user's leagues
//   - leaguemates:   every other manager the user shares a league with
//   - pick_shares:   same as player_shares but for draft picks
//
// Pure — no I/O, safe to call from a useMemo.
export function deriveCollections(leagues: LeagueDetailed[]): {
  player_shares: PlayerShares;
  leaguemates: Leaguemates;
  pick_shares: PickShares;
} {
  const player_shares: PlayerShares = {};
  const leaguemates: Leaguemates = {};
  const pick_shares: PickShares = {};

  leagues.forEach((league) => {
    league.rosters.forEach((roster) => {
      const is_user = roster.roster_id === league.user_roster.roster_id;

      // Only build leaguemates entries for *other* managers. Guarding the
      // push (not just the create) avoids touching `undefined.leagues` for
      // the user's own roster.
      if (!is_user) {
        if (!leaguemates[roster.user_id]) {
          leaguemates[roster.user_id] = {
            display_name: roster.username,
            avatar: roster.avatar,
            leagues: [],
          };
        }
        leaguemates[roster.user_id].leagues.push(league.league_id);
      }

      (roster.players ?? []).forEach((player_id) => {
        if (!player_shares[player_id]) {
          player_shares[player_id] = { owned: [], taken: [] };
        }
        if (is_user) {
          player_shares[player_id].owned.push(league.league_id);
        } else {
          player_shares[player_id].taken.push({
            user_id: roster.user_id,
            league_id: league.league_id,
          });
        }
      });

      roster.draftpicks.forEach((pick) => {
        const pick_id = getPickId(pick);
        if (!pick_shares[pick_id]) {
          pick_shares[pick_id] = { pick, owned: [], taken: [] };
        }
        if (is_user) {
          pick_shares[pick_id].owned.push(league.league_id);
        } else {
          pick_shares[pick_id].taken.push({
            user_id: roster.user_id,
            league_id: league.league_id,
          });
        }
      });
    });
  });

  return { player_shares, leaguemates, pick_shares };
}
