import getPool from '../lib/db'
import {
  fetchKtcLatest as _fetchKtcLatest,
  fetchKtcByDate as _fetchKtcByDate,
  fetchKtcHistory as _fetchKtcHistory,
} from '@sleepier/shared'

export type { KtcData, KtcHistory } from '@sleepier/shared'

export const fetchKtcLatest = () => _fetchKtcLatest(getPool())
export const fetchKtcByDate = (date: string) => _fetchKtcByDate(getPool(), date)
export const fetchKtcHistory = (playerIds: string[], days?: number) =>
  _fetchKtcHistory(getPool(), playerIds, days)
