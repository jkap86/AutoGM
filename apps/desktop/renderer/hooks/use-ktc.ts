'use client'

import { useEffect, useState } from 'react'

type KtcData = {
  latest_date: string
  last_updated: string
  player_values: Record<string, number>
}

type KtcHistory = {
  player_id: string
  date: string
  value: number
  overall_rank: number | null
  position_rank: number | null
}[]

export function useKtc() {
  const [data, setData] = useState<KtcData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.ipc.invoke<KtcData>('ktc:latest').then(
      (result) => {
        if (cancelled) return
        setData(result)
        setLoading(false)
      },
      (e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      },
    )
    return () => { cancelled = true }
  }, [])

  return { ktc: data?.player_values ?? {}, latestDate: data?.latest_date, loading, error }
}

export function useKtcHistory(playerIds: string[], days = 90) {
  const [data, setData] = useState<KtcHistory>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (playerIds.length === 0) return
    let cancelled = false
    setLoading(true)
    window.ipc.invoke<KtcHistory>('ktc:history', { playerIds, days }).then(
      (result) => {
        if (cancelled) return
        setData(result)
        setLoading(false)
      },
      () => { if (!cancelled) setLoading(false) },
    )
    return () => { cancelled = true }
  }, [playerIds.join(','), days])

  return { history: data, loading }
}
