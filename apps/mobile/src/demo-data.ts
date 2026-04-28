import type { LeaguesPayload, LeagueDetailed, Roster, DraftpickDetailed } from '@autogm/shared'

const DEMO_USER_ID = 'demo_user'

function makeRoster(id: number, username: string, userId: string, wins: number, losses: number, fp: number): Roster {
  return {
    roster_id: id,
    username,
    user_id: userId,
    avatar: null,
    players: [],
    draftpicks: [],
    starters: [],
    starters_optimal_dynasty: [],
    starters_optimal_redraft: [],
    taxi: [],
    reserve: [],
    wins,
    losses,
    ties: 0,
    fp,
    fpa: fp - 50 + Math.random() * 100,
  }
}

function makeDemoPicks(rosterId: number, userId: string): DraftpickDetailed[] {
  return [1, 2, 3].map((round) => ({
    season: '2026',
    roster_id: rosterId,
    round,
    original_user: { avatar: null, user_id: userId, username: 'DemoUser' },
    order: null,
  }))
}

function makeLeague(
  id: string,
  name: string,
  type: number,
  teamCount: number,
  userWins: number,
  userLosses: number,
  userFp: number,
): LeagueDetailed {
  const userRoster = makeRoster(1, 'DemoUser', DEMO_USER_ID, userWins, userLosses, userFp)
  userRoster.draftpicks = makeDemoPicks(1, DEMO_USER_ID)

  const opponents = Array.from({ length: teamCount - 1 }, (_, i) => {
    const wins = Math.floor(Math.random() * 10)
    return makeRoster(i + 2, `Team${i + 2}`, `user_${i + 2}`, wins, 10 - wins, 1200 + Math.random() * 400)
  })

  return {
    league_id: id,
    name,
    avatar: null,
    season: '2026',
    settings: {
      taxi_slots: type === 2 ? 3 : 0,
      reserve_slots: 2,
      best_ball: 0,
      type,
      reserve_allow_na: 1,
      reserve_allow_doubtful: 0,
      league_average_match: 0,
      draft_rounds: type === 2 ? 4 : 15,
      playoff_week_start: 15,
      trade_deadline: 12,
      disable_trades: 0,
      daily_waivers: 0,
    },
    scoring_settings: { pass_td: 4, rec: 1 },
    roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'SUPER_FLEX', 'BN', 'BN', 'BN', 'BN', 'BN'],
    total_rosters: teamCount,
    previous_league_id: null,
    index: 0,
    rosters: [userRoster, ...opponents],
    user_roster: userRoster,
  }
}

export const DEMO_LEAGUES_PAYLOAD: LeaguesPayload = {
  user: {
    user_id: DEMO_USER_ID,
    display_name: 'DemoUser',
    avatar: null,
  },
  leagues: {
    demo_dynasty: makeLeague('demo_dynasty', 'Dynasty Champions League', 2, 12, 7, 3, 1456.2),
    demo_redraft: makeLeague('demo_redraft', 'Sunday Showdown', 0, 10, 5, 5, 1320.8),
    demo_keeper: makeLeague('demo_keeper', 'Keeper Kings', 1, 12, 8, 2, 1510.4),
  },
  updated_at: Date.now(),
}

export const DEMO_SESSION = {
  token: 'demo_token',
  user_id: DEMO_USER_ID,
}
