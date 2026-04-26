import type { AdpFilters, AdpRow } from '@sleepier/shared'
import { apiPost } from '../lib/api-client'

export type { AdpFilters, AdpRow } from '@sleepier/shared'

export const fetchAdp = (filters: AdpFilters = {}) =>
  apiPost<AdpRow[]>('/api/adp/fetch', filters)

export const fetchAdpStats = (filters: AdpFilters = {}) =>
  apiPost<{ n_drafts: number; n_leagues: number }>('/api/adp/stats', filters)
