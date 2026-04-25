import { useCallback, useState } from 'react'
import { mobileDataClient } from '../data-client'
import {
  findBlockingRecord,
  recordOperation,
  tradeActionKey,
} from '../operation-store'

type ActionName = 'acceptTrade' | 'rejectTrade'

export function useTradeAction() {
  const [acting, setActing] = useState(false)

  const execute = useCallback(
    async (
      action: ActionName,
      vars: { league_id: string; transaction_id: string; leg: number },
    ) => {
      const opKey = tradeActionKey(action, vars)
      const blocking = await findBlockingRecord(opKey)
      if (blocking) {
        throw new Error(`Duplicate ${action} blocked (status: ${blocking.status})`)
      }

      setActing(true)
      await recordOperation(opKey, 'pending')
      try {
        const result = await mobileDataClient.graphql(action, vars)
        const txId =
          action === 'acceptTrade'
            ? (result as { accept_trade: { transaction_id: string } }).accept_trade?.transaction_id
            : (result as { reject_trade: { transaction_id: string } }).reject_trade?.transaction_id
        await recordOperation(opKey, 'success', txId ?? null)
        return result
      } catch (e) {
        await recordOperation(opKey, 'failed')
        throw e
      } finally {
        setActing(false)
      }
    },
    [],
  )

  return { acting, execute }
}
