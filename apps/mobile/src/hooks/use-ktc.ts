import { useCallback, useEffect, useState } from 'react'
import type { KtcData } from '@autogm/shared'
import { mobileDataClient } from '../data-client'

export function useKtc() {
  const [ktc, setKtc] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const data = await mobileDataClient.fetchKtcLatest()
      setKtc(data.player_values)
    } catch (e) {
      console.warn('KTC fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { ktc, loading, refetch: fetch }
}
