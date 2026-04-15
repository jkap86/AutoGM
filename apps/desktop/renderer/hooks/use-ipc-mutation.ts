'use client'

import { useCallback, useState } from 'react'
import type { QueryMap, QueryName } from '@sleepier/shared'

type State<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

// Manual-trigger counterpart to useIpcQuery. Use for mutations (propose_trade,
// accept_trade, etc.) — anything you want to fire on a button click rather
// than on mount.
export function useIpcMutation<N extends QueryName>(name: N) {
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
