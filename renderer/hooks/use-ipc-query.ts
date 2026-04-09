'use client'

import { useEffect, useState } from 'react'
import type { QueryMap, QueryName } from '../../main/graphql/queries/types'

type State<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

export function useIpcQuery<N extends QueryName>(
  name: N,
  vars: QueryMap[N]['vars']
) {
  const [state, setState] = useState<State<QueryMap[N]['result']>>({
    data: null,
    loading: false,
    error: null,
  })

  // Stable dependency for vars — assumes simple flat objects.
  const varsKey = JSON.stringify(vars)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    window.ipc
      .invoke<QueryMap[N]['result']>('graphql', { name, vars })
      .then(
        (data) => {
          if (cancelled) return
          setState({ data, loading: false, error: null })
        },
        (e) => {
          if (cancelled) return
          setState({
            data: null,
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      )

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, varsKey])

  return state
}
