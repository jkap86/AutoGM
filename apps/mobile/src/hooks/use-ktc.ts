import { useCallback, useEffect, useState } from 'react'
import { getSession } from '@autogm/shared'
import { mobileDataClient } from '../data-client'
import { useAuth } from '@autogm/shared/react'

export function useKtc() {
  const [ktc, setKtc] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const { session } = useAuth()

  const fetchKtc = useCallback(async () => {
    const s = getSession()
    if (!s?.user_id) return
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

  // Fetch once session is available
  useEffect(() => {
    if (session?.user_id) fetchKtc()
  }, [session?.user_id, fetchKtc])

  return { ktc, loading, refetch: fetchKtc }
}
