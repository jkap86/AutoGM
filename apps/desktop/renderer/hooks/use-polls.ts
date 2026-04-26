'use client'

import { useCallback, useEffect, useState } from 'react'
import type { StoredPoll } from '../../types/poll'
import type { PollVote, ListPollVotesResult } from '@autogm/shared'

export type PollWithVotes = StoredPoll & {
  votes: PollVote[]
}

export type PollGroup = {
  group_id: string
  prompt: string
  choices: string[]
  poll_type: string
  privacy: string
  created_at: number
  polls: PollWithVotes[]
  aggregateVotes: PollVote[]
}

type State = {
  groups: PollGroup[]
  loading: boolean
  error: string | null
}

function groupPolls(polls: PollWithVotes[]): PollGroup[] {
  const map = new Map<string, PollWithVotes[]>()
  for (const poll of polls) {
    const key = poll.group_id ?? poll.poll_id
    const list = map.get(key)
    if (list) list.push(poll)
    else map.set(key, [poll])
  }

  const groups: PollGroup[] = []
  for (const [group_id, groupPolls] of map) {
    const first = groupPolls[0]
    // Aggregate votes across all polls in the group, mapping each poll's
    // choice_id back to a normalized index so they combine correctly.
    const aggregateVotes: PollVote[] = []
    for (const poll of groupPolls) {
      const order = poll.choices_order ?? []
      for (const vote of poll.votes) {
        const sourceIdx = order.indexOf(vote.choice_id)
        const normalizedId = sourceIdx !== -1 ? String(sourceIdx) : vote.choice_id
        aggregateVotes.push({ ...vote, choice_id: normalizedId })
      }
    }

    groups.push({
      group_id,
      prompt: first.prompt,
      choices: first.choices,
      poll_type: first.poll_type,
      privacy: first.privacy,
      created_at: first.created_at,
      polls: groupPolls,
      aggregateVotes,
    })
  }

  return groups.sort((a, b) => b.created_at - a.created_at)
}

export function usePolls() {
  const [state, setState] = useState<State>({
    groups: [],
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

      setState({ groups: groupPolls(polls), loading: false, error: null })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      setState({ groups: [], loading: false, error })
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const removeGroup = useCallback(
    async (groupId: string) => {
      await window.ipc.invoke('polls:remove-group', groupId)
      setState((s) => ({
        ...s,
        groups: s.groups.filter((g) => g.group_id !== groupId),
      }))
    },
    [],
  )

  return { ...state, refetch: fetch, removeGroup }
}
