import type { KtcData, KtcHistory } from '@autogm/shared'
import { apiGet } from '../lib/api-client'

export type { KtcData, KtcHistory } from '@autogm/shared'

export const fetchKtcLatest = () =>
  apiGet<KtcData>('/api/ktc/latest')

export const fetchKtcByDate = (date: string) =>
  apiGet<KtcData>(`/api/ktc/by-date?date=${encodeURIComponent(date)}`)

export const fetchKtcHistory = (playerIds: string[], days?: number) =>
  apiGet<KtcHistory>(
    `/api/ktc/history?playerIds=${encodeURIComponent(playerIds.join(','))}&days=${days ?? 90}`,
  )
