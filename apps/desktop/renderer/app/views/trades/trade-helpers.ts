import type { Allplayer, Roster } from "@autogm/shared";

export function buildPlayerAttachment(p: Allplayer | undefined) {
  if (!p) return { player_id: "0" };
  return {
    position: p.position,
    first_name: p.first_name,
    last_name: p.last_name,
    sport: "nfl",
    team: p.team,
    player_id: p.player_id,
    fantasy_positions: p.fantasy_positions,
    years_exp: p.years_exp,
  };
}

export function buildUserAttachment(roster: Roster, league_id: string) {
  return {
    avatar: roster.avatar,
    display_name: roster.username,
    is_bot: false,
    is_owner: null,
    league_id,
    metadata: {},
    settings: null,
    user_id: roster.user_id,
  };
}
