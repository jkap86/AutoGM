import pool from '../lib/db'
import {
  fetchAdp as _fetchAdp,
  fetchAdpStats as _fetchAdpStats,
} from '@sleepier/shared'

export type { AdpFilters, AdpRow } from '@sleepier/shared'

export const fetchAdp = (filters = {}) => _fetchAdp(pool, filters)
export const fetchAdpStats = (filters = {}) => _fetchAdpStats(pool, filters)
