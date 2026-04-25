import { useCallback, useState } from 'react'
import type { CreatePollResult, CreatePollMessageResult } from '@sleepier/shared'
import { mobileDataClient } from '../data-client'

type State = {
  loading: boolean
  error: string | null
}

type CreatePollParams = {
  prompt: string
  choices: string[]
  poll_type: string
  privacy: string
  group_id: string
  league_id: string
  text?: string
}

export function useCreatePoll() {
  const [state, setState] = useState<State>({ loading: false, error: null })

  const createPoll = useCallback(async (params: CreatePollParams) => {
    setState({ loading: true, error: null })
    try {
      const sleeperPollType = params.poll_type === 'multiple' ? 'multi' : params.poll_type
      const pollResult = await mobileDataClient.graphql('createPoll', {
        prompt: params.prompt,
        choices: params.choices,
        k_metadata: ['poll_type', 'privacy'],
        v_metadata: [sleeperPollType, params.privacy],
      }) as CreatePollResult

      const poll_id = pollResult.create_poll.poll_id

      const messageResult = await mobileDataClient.graphql('createPollMessage', {
        parent_id: params.league_id,
        attachment_id: poll_id,
        text: params.text ?? '',
      }) as CreatePollMessageResult

      setState({ loading: false, error: null })
      return {
        poll_id,
        choices_order: pollResult.create_poll.choices_order as string[],
        message: messageResult,
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      setState({ loading: false, error })
      throw e
    }
  }, [])

  return { ...state, createPoll }
}
