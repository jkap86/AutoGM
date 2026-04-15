export type League = {
  league_id: string;
  name: string;
  avatar: string;
  season: string;
  settings: LeagueSettings;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  total_rosters: number;
  previous_league_id: string | null;
};

export type LeagueSettings = {
  taxi_slots: number;
  reserve_slots: number;
  best_ball: number;
  type: number;
  reserve_allow_na: number;
  reserve_allow_doubtful: number;
  league_average_match: number;
  draft_rounds: number;
  playoff_week_start: number;
  trade_deadline: number;
  disable_trades: number;
  daily_waivers: number;
};

export type Draft = {
  draft_id: string;
  season: string;
  draft_order: {
    [key: string]: number;
  };
  last_picked: number | null;
  status: string;
  settings: {
    rounds: number;
    slots_k: number;
  };
};

export type SleeperRoster = {
  roster_id: number;
  players: string[] | null;
  reserve?: string[];
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
  };
  starters: string[] | null;
  taxi?: string[];
  owner_id: string;
};

export type User = {
  user_id: string;
  display_name: string;
  avatar: string | null;
};

export type Draftpick = {
  season: string;
  owner_id: number;
  roster_id: number;
  previous_owner_id: number;
  round: number;
};

export type DraftpickDetailed = {
  season: string;
  roster_id: number;
  round: number;
  original_user: {
    avatar: string | null;
    user_id: string;
    username: string;
  };
  order: number | null;
};

export type Roster = {
  roster_id: number;
  username: string;
  user_id: string;
  avatar: string | null;
  players: string[];
  draftpicks: DraftpickDetailed[];
  starters: string[];
  starters_optimal_dynasty: string[];
  starters_optimal_redraft: string[];
  taxi: string[];
  reserve: string[];
  wins: number;
  losses: number;
  ties: number;
  fp: number;
  fpa: number;
};

export type LeagueDetailed = League & {
  index: number;
  rosters: Roster[];
  user_roster: Roster;
};

export type LeaguesPayload = {
  user: User;
  leagues: { [league_id: string]: LeagueDetailed };
  updated_at: number;
};

export type Leaguemates = {
  [user_id: string]: {
    display_name: string;
    avatar: string | null;
    leagues: string[];
  };
};

export type PlayerShares = {
  [player_id: string]: {
    owned: string[];
    taken: { user_id: string; league_id: string }[];
  };
};

export type PickShares = {
  [pick_id: string]: {
    pick: DraftpickDetailed;
    owned: string[];
    taken: { user_id: string; league_id: string }[];
  };
};

export type Allplayer = {
  player_id: string;
  position: string;
  team: string;
  full_name: string;
  first_name: string;
  last_name: string;
  age: string;
  fantasy_positions: string[];
  years_exp: number;
  active: boolean;
};
