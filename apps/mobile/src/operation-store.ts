import AsyncStorage from '@react-native-async-storage/async-storage'
import { createHash } from './hash'

export type OperationStatus = 'pending' | 'success' | 'poll_created' | 'failed'

export type OperationRecord = {
  key: string
  status: OperationStatus
  result_id: string | null
  created_at: number
  updated_at: number
}

const STORAGE_KEY = 'autogm_operations'
const OPERATION_TTL_MS = 5 * 60 * 1000 // 5 minutes

const BLOCKING_STATUSES = new Set<OperationStatus>(['pending', 'success', 'poll_created'])

async function load(): Promise<OperationRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  const ops: OperationRecord[] = JSON.parse(raw)
  const now = Date.now()
  return ops.filter((o) => now - o.created_at < OPERATION_TTL_MS)
}

async function save(ops: OperationRecord[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ops))
}

/**
 * Find a recent record regardless of status.
 */
export async function findRecentRecord(key: string): Promise<OperationRecord | null> {
  const ops = await load()
  return ops.find((o) => o.key === key) ?? null
}

/**
 * Find a recent record that blocks a retry.
 * Failed operations do NOT block — they can be retried.
 */
export async function findBlockingRecord(key: string): Promise<OperationRecord | null> {
  const found = await findRecentRecord(key)
  if (!found) return null
  return BLOCKING_STATUSES.has(found.status) ? found : null
}

/**
 * Record an operation with a given status.
 */
export async function recordOperation(
  key: string,
  status: OperationStatus,
  resultId: string | null = null,
): Promise<void> {
  const ops = await load()
  const now = Date.now()
  const idx = ops.findIndex((o) => o.key === key)
  if (idx !== -1) {
    ops[idx] = { ...ops[idx], status, result_id: resultId, updated_at: now }
  } else {
    ops.push({ key, status, result_id: resultId, created_at: now, updated_at: now })
  }
  await save(ops)
}

// ---- Key builders ----

function makeKey(parts: unknown[]): string {
  return createHash(JSON.stringify(parts))
}

export function pollOperationKey(vars: {
  league_id: string
  group_id: string
  prompt: string
  choices: string[]
  poll_type: string
  privacy: string
}): string {
  return makeKey([
    'createPoll',
    vars.league_id,
    vars.group_id,
    vars.prompt,
    vars.choices,
    vars.poll_type,
    vars.privacy,
  ])
}

export function tradeActionKey(
  action: 'acceptTrade' | 'rejectTrade',
  vars: { league_id: string; transaction_id: string; leg: number },
): string {
  return makeKey([action, vars.league_id, vars.transaction_id, vars.leg])
}
