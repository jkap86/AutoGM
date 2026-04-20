import { describe, it, expect } from 'vitest'
import { buildPlayerAttachment, buildUserAttachment } from './trade-helpers'
import type { Allplayer, Roster } from '../types'

describe('buildPlayerAttachment', () => {
  it('returns minimal object for undefined player', () => {
    expect(buildPlayerAttachment(undefined)).toEqual({ player_id: '0' })
  })

  it('maps correct fields from a player', () => {
    const player = {
      player_id: '4046',
      position: 'QB',
      first_name: 'Josh',
      last_name: 'Allen',
      team: 'BUF',
      fantasy_positions: ['QB'],
      years_exp: 7,
      full_name: 'Josh Allen',
      age: '28',
      active: true,
    } as Allplayer

    const result = buildPlayerAttachment(player)
    expect(result).toEqual({
      player_id: '4046',
      position: 'QB',
      first_name: 'Josh',
      last_name: 'Allen',
      sport: 'nfl',
      team: 'BUF',
      fantasy_positions: ['QB'],
      years_exp: 7,
    })
  })
})

describe('buildUserAttachment', () => {
  it('builds attachment from roster and league_id', () => {
    const roster = {
      avatar: 'av1',
      username: 'Bob',
      user_id: 'u1',
      roster_id: 1,
    } as Roster

    const result = buildUserAttachment(roster, 'L1')
    expect(result).toEqual({
      avatar: 'av1',
      display_name: 'Bob',
      is_bot: false,
      is_owner: null,
      league_id: 'L1',
      metadata: {},
      settings: null,
      user_id: 'u1',
    })
  })
})
