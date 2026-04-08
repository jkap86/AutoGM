'use client'

import { useEffect, useState } from 'react'
import type { LeaguesPayload } from '../../main/lib/types'

export function useLeagues({
  user_id,
  season,
}: {
  user_id: string | null | undefined
  season: string
}) {
  const [data, setData] = useState<LeaguesPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user_id) return

    let cancelled = false
    setLoading(true)
    setError(null)

    window.ipc
      .invoke<LeaguesPayload>('leagues:fetch', { user_id, season })
      .then(
        (payload) => {
          if (cancelled) return
          setData(payload)
          setLoading(false)
        },
        (e) => {
          if (cancelled) return
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      )

    return () => {
      cancelled = true
    }
  }, [user_id, season])

  return { data, loading, error }
}
