import type { OpponentDraftPick } from '@sleepier/shared'
import { apiGet } from '../lib/api-client'

export type { OpponentDraftPick } from '@sleepier/shared'

export const fetchOpponentDrafts = (userId: string) =>
  apiGet<OpponentDraftPick[]>(`/api/opponent/drafts?userId=${encodeURIComponent(userId)}`)
