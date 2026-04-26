import { useCallback, useEffect, useState } from 'react'
import type { ListPollVotesResult, PollVote } from '@autogm/shared'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { mobileDataClient } from '../data-client'

const POLLS_KEY = 'autogm_polls'

export type StoredPoll = {
  poll_id: string
  group_id: string
  league_id: string
  prompt: string
  choices: string[]
  choices_order: string[]
  poll_type: string
  privacy: string
  created_at: number
}

export type PollWithVotes = StoredPoll & { votes: PollVote[] }

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

async function loadPolls(): Promise<StoredPoll[]> {
  const raw = await AsyncStorage.getItem(POLLS_KEY)
  return raw ? JSON.parse(raw) : []
}

async function savePolls(polls: StoredPoll[]) {
  await AsyncStorage.setItem(POLLS_KEY, JSON.stringify(polls))
}

export async function addPoll(poll: StoredPoll) {
  const polls = await loadPolls()
  const idx = polls.findIndex((p) => p.poll_id === poll.poll_id)
  if (idx !== -1) polls[idx] = poll
  else polls.push(poll)
  await savePolls(polls)
}

export async function removePollGroup(groupId: string) {
  const polls = (await loadPolls()).filter((p) => p.group_id !== groupId)
  await savePolls(polls)
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
  const [groups, setGroups] = useState<PollGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const stored = await loadPolls()
      const polls = await Promise.all(
        stored.map(async (poll) => {
          try {
            const result = (await mobileDataClient.graphql('listPollVotes', {
              poll_id: poll.poll_id,
            })) as ListPollVotesResult
            return { ...poll, votes: result.list_poll_votes }
          } catch (e) {
            console.warn(`[use-polls] Failed to fetch votes for ${poll.poll_id}:`, e)
            return { ...poll, votes: [] as PollVote[] }
          }
        }),
      )
      setGroups(groupPolls(polls))
      setLoading(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const removeGroup = useCallback(async (groupId: string) => {
    await removePollGroup(groupId)
    setGroups((prev) => prev.filter((g) => g.group_id !== groupId))
  }, [])

  return { groups, loading, error, refetch: fetch, removeGroup }
}
