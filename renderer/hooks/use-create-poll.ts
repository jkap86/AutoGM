'use client'

import { useCallback, useState } from 'react'
import type {
  CreatePollVars,
  CreatePollResult,
  CreatePollMessageResult,
} from '../../main/graphql/queries/types'

type State = {
  data: CreatePollMessageResult | null
  loading: boolean
  error: string | null
}

type CreatePollParams = CreatePollVars & {
  league_id: string
  text?: string
}

export function useCreatePoll() {
  const [state, setState] = useState<State>({
    data: null,
    loading: false,
    error: null,
  })

  const createPoll = useCallback(
    async (params: CreatePollParams): Promise<CreatePollMessageResult> => {
      setState({ data: null, loading: true, error: null })
      try {
        const pollResult = await window.ipc.invoke<CreatePollResult>('graphql', {
          name: 'createPoll',
          vars: {
            prompt: params.prompt,
            choices: params.choices,
            k_metadata: params.k_metadata,
            v_metadata: params.v_metadata,
          },
        })

        const poll_id = pollResult.create_poll.poll_id

        const messageResult = await window.ipc.invoke<CreatePollMessageResult>(
          'graphql',
          {
            name: 'createPollMessage',
            vars: {
              parent_id: params.league_id,
              attachment_id: poll_id,
              text: params.text ?? '',
            },
          }
        )

        await window.ipc.invoke('polls:add', {
          poll_id,
          league_id: params.league_id,
          prompt: params.prompt,
          choices: params.choices,
          choices_order: pollResult.create_poll.choices_order as string[],
          poll_type: params.v_metadata[0] ?? 'single',
          privacy: params.v_metadata[1] ?? 'public',
          created_at: Date.now(),
        })

        setState({ data: messageResult, loading: false, error: null })
        return messageResult
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        setState({ data: null, loading: false, error })
        throw e
      }
    },
    []
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { ...state, createPoll, reset }
}
