'use client'

import { useCallback, useState } from 'react'
import type { QueryMap, QueryName } from '@sleepier/shared'

type State<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Mutation hook for dedicated IPC channels.
 * Vars are sent directly as the IPC argument.
 */
export function useIpcMutation<N extends QueryName>(channel: string) {
  const [state, setState] = useState<State<QueryMap[N]['result']>>({
    data: null,
    loading: false,
    error: null,
  })

  const mutate = useCallback(
    async (vars: QueryMap[N]['vars']): Promise<QueryMap[N]['result']> => {
      setState({ data: null, loading: true, error: null })
      try {
        const data = await window.ipc.invoke<QueryMap[N]['result']>(channel, vars)
        setState({ data, loading: false, error: null })
        return data
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        setState({ data: null, loading: false, error })
        throw e
      }
    },
    [channel]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { ...state, mutate, reset }
}

/**
 * Mutation hook that goes through the generic "graphql" IPC channel.
 * Wraps vars in { name, vars } for the graphql handler.
 */
export function useGraphqlMutation<N extends QueryName>(name: N) {
  const [state, setState] = useState<State<QueryMap[N]['result']>>({
    data: null,
    loading: false,
    error: null,
  })

  const mutate = useCallback(
    async (vars: QueryMap[N]['vars']): Promise<QueryMap[N]['result']> => {
      setState({ data: null, loading: true, error: null })
      try {
        const data = await window.ipc.invoke<QueryMap[N]['result']>('graphql', {
          name,
          vars,
        })
        setState({ data, loading: false, error: null })
        return data
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        setState({ data: null, loading: false, error })
        throw e
      }
    },
    [name]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { ...state, mutate, reset }
}
