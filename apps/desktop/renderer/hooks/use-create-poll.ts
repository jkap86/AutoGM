'use client'

import { useCallback, useState } from 'react'
import type {
  CreatePollVars,
  CreatePollMessageResult,
} from '@sleepier/shared'

type State = {
  data: { poll_id: string; message: CreatePollMessageResult } | null
  loading: boolean
  error: string | null
}

type CreatePollParams = CreatePollVars & {
  group_id: string
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
    async (params: CreatePollParams) => {
      setState({ data: null, loading: true, error: null })
      try {
        const result = await window.ipc.invoke<{
          poll_id: string
          message: CreatePollMessageResult
        }>('polls:create', {
          prompt: params.prompt,
          choices: params.choices,
          k_metadata: params.k_metadata,
          v_metadata: params.v_metadata,
          group_id: params.group_id,
          league_id: params.league_id,
          text: params.text,
        })

        setState({ data: result, loading: false, error: null })
        return result
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
