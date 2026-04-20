import { describe, it, expect } from 'vitest'
import { getPickId, deriveCollections } from './leagues'
import type { DraftpickDetailed, LeagueDetailed } from '../types'

function makePick(overrides: Partial<DraftpickDetailed> = {}): DraftpickDetailed {
  return {
    season: '2025',
    round: 1,
    roster_id: 1,
    order: null,
    original_user: { avatar: '', user_id: 'u1', username: 'test' },
    ...overrides,
  }
}

describe('getPickId', () => {
  it('formats with order padded to 2 digits', () => {
    expect(getPickId(makePick({ order: 3 }))).toBe('2025 1.03')
  })

  it('formats double-digit order', () => {
    expect(getPickId(makePick({ order: 12 }))).toBe('2025 1.12')
  })

  it('formats without order when order is null', () => {
    expect(getPickId(makePick({ order: null, round: 2 }))).toBe('2025 Round 2')
  })
})

describe('deriveCollections', () => {
  it('returns empty collections for empty input', () => {
    const result = deriveCollections([])
    expect(result.player_shares).toEqual({})
    expect(result.leaguemates).toEqual({})
    expect(result.pick_shares).toEqual({})
  })

  it('categorizes owned vs taken players', () => {
    const league = {
      league_id: 'L1',
      user_roster: { roster_id: 1 },
      rosters: [
        {
          roster_id: 1,
          user_id: 'me',
          username: 'Me',
          avatar: null,
          players: ['P1'],
          draftpicks: [],
        },
        {
          roster_id: 2,
          user_id: 'them',
          username: 'Them',
          avatar: 'av',
          players: ['P1', 'P2'],
          draftpicks: [],
        },
      ],
    } as unknown as LeagueDetailed

    const result = deriveCollections([league])
    expect(result.player_shares['P1'].owned).toEqual(['L1'])
    expect(result.player_shares['P1'].taken).toEqual([
      { user_id: 'them', league_id: 'L1' },
    ])
    expect(result.player_shares['P2'].owned).toEqual([])
    expect(result.player_shares['P2'].taken).toEqual([
      { user_id: 'them', league_id: 'L1' },
    ])
  })

  it('tracks leaguemates (non-user rosters)', () => {
    const league = {
      league_id: 'L1',
      user_roster: { roster_id: 1 },
      rosters: [
        { roster_id: 1, user_id: 'me', username: 'Me', avatar: null, players: [], draftpicks: [] },
        { roster_id: 2, user_id: 'opp', username: 'Opponent', avatar: 'av', players: [], draftpicks: [] },
      ],
    } as unknown as LeagueDetailed

    const result = deriveCollections([league])
    expect(result.leaguemates['opp']).toEqual({
      display_name: 'Opponent',
      avatar: 'av',
      leagues: ['L1'],
    })
    expect(result.leaguemates['me']).toBeUndefined()
  })

  it('tracks pick shares', () => {
    const pick = makePick({ season: '2025', round: 1 })
    const league = {
      league_id: 'L1',
      user_roster: { roster_id: 1 },
      rosters: [
        { roster_id: 1, user_id: 'me', username: 'Me', avatar: null, players: [], draftpicks: [pick] },
        { roster_id: 2, user_id: 'them', username: 'Them', avatar: null, players: [], draftpicks: [pick] },
      ],
    } as unknown as LeagueDetailed

    const result = deriveCollections([league])
    const pickId = '2025 Round 1'
    expect(result.pick_shares[pickId].owned).toEqual(['L1'])
    expect(result.pick_shares[pickId].taken).toEqual([
      { user_id: 'them', league_id: 'L1' },
    ])
  })
})
