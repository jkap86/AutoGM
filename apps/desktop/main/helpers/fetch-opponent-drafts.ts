import type { OpponentDraftPick } from '@autogm/shared'
import { apiGet } from '../lib/api-client'

export type { OpponentDraftPick } from '@autogm/shared'

export const fetchOpponentDrafts = (userId: string) =>
  apiGet<OpponentDraftPick[]>(`/api/opponent/drafts?userId=${encodeURIComponent(userId)}`)
