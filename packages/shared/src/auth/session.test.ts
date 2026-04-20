import { describe, it, expect, beforeEach } from 'vitest'
import { setSession, getSession, getToken, clearSession } from './session'

describe('session', () => {
  beforeEach(() => {
    clearSession()
  })

  it('starts with null session', () => {
    expect(getSession()).toBeNull()
    expect(getToken()).toBeNull()
  })

  it('setSession stores and getSession retrieves', () => {
    setSession({ token: 'abc', user_id: '123' })
    expect(getSession()).toEqual({ token: 'abc', user_id: '123' })
  })

  it('getToken returns the token from the active session', () => {
    setSession({ token: 'xyz', user_id: '456' })
    expect(getToken()).toBe('xyz')
  })

  it('clearSession resets to null', () => {
    setSession({ token: 'abc', user_id: '123' })
    clearSession()
    expect(getSession()).toBeNull()
    expect(getToken()).toBeNull()
  })

  it('setSession with null clears the session', () => {
    setSession({ token: 'abc', user_id: '123' })
    setSession(null)
    expect(getSession()).toBeNull()
  })
})
