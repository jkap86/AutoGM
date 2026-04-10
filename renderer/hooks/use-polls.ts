'use client'

import { useCallback, useEffect, useState } from 'react'
import type { StoredPoll } from '../../main/lib/poll-store'
import type { PollVote, ListPollVotesResult } from '../../main/graphql/queries/types'

export type PollWithVotes = StoredPoll & {
  votes: PollVote[]
}

type State = {
  polls: PollWithVotes[]
  loading: boolean
  error: string | null
}

export function usePolls() {
  const [state, setState] = useState<State>({
    polls: [],
    loading: false,
    error: null,
  })

  const fetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const stored = await window.ipc.invoke<StoredPoll[]>('polls:list')

      const polls = await Promise.all(
        stored.map(async (poll) => {
          const result = await window.ipc.invoke<ListPollVotesResult>(
            'graphql',
            {
              name: 'listPollVotes',
              vars: { poll_id: poll.poll_id },
            },
          )
          return { ...poll, votes: result.list_poll_votes }
        }),
      )

      setState({ polls, loading: false, error: null })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      setState({ polls: [], loading: false, error })
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const remove = useCallback(
    async (pollId: string) => {
      await window.ipc.invoke('polls:remove', pollId)
      setState((s) => ({
        ...s,
        polls: s.polls.filter((p) => p.poll_id !== pollId),
      }))
    },
    [],
  )

  return { ...state, refetch: fetch, remove }
}
