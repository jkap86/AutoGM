import Store from "electron-store";
import crypto from "crypto";

export type OperationStatus =
  | "pending"
  | "success"
  | "poll_created"
  | "failed"
  | "unknown";

/** Statuses that block a retry of the same operation key. */
const BLOCKING_STATUSES = new Set<OperationStatus>([
  "pending",
  "success",
  "poll_created",
]);

export type OperationRecord = {
  key: string;
  status: OperationStatus;
  result_id: string | null;
  created_at: number;
  updated_at: number;
};

type OperationStoreSchema = {
  operations: OperationRecord[];
};

const TTL_MS = 5 * 60 * 1000; // 5 minutes

let _store: Store<OperationStoreSchema> | null = null;

function getStore(): Store<OperationStoreSchema> {
  if (!_store) {
    _store = new Store<OperationStoreSchema>({
      name: "operations",
      defaults: { operations: [] },
    });
  }
  return _store;
}

function makeKey(parts: unknown[]): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex");
}

/** Prune expired entries and return the store list. */
function prune(): OperationRecord[] {
  const now = Date.now();
  const ops = getStore()
    .get("operations")
    .filter((o) => now - o.created_at < TTL_MS);
  getStore().set("operations", ops);
  return ops;
}

/**
 * Find a recent record regardless of status.
 * Returns the record if found (any status), or null if no record exists.
 */
export function findRecentRecord(key: string): OperationRecord | null {
  const ops = prune();
  return ops.find((o) => o.key === key) ?? null;
}

/**
 * Find a recent record that blocks a retry.
 * Failed and unknown operations do NOT block — they can be retried.
 * Returns the blocking record, or null if the operation is safe to attempt.
 */
export function findBlockingRecord(key: string): OperationRecord | null {
  const found = findRecentRecord(key);
  if (!found) return null;
  return BLOCKING_STATUSES.has(found.status) ? found : null;
}

/** Record an operation with a given status. */
export function recordOperation(
  key: string,
  status: OperationStatus,
  resultId: string | null = null,
): void {
  const ops = prune();
  const idx = ops.findIndex((o) => o.key === key);
  const now = Date.now();
  if (idx !== -1) {
    ops[idx] = { ...ops[idx], status, result_id: resultId, updated_at: now };
  } else {
    ops.push({ key, status, result_id: resultId, created_at: now, updated_at: now });
  }
  getStore().set("operations", ops);
}

// ---- Key builders ----

/**
 * Build an idempotency key for a proposeTrade mutation.
 * k_adds/v_adds and k_drops/v_drops are normalized as paired tuples.
 */
export function tradeOperationKey(vars: {
  league_id: string;
  k_adds: string[];
  v_adds: number[];
  k_drops: string[];
  v_drops: number[];
  draft_picks?: string[];
  waiver_budget?: string[];
  reject_transaction_id?: string;
  reject_transaction_leg?: number;
}): string {
  const adds = vars.k_adds
    .map((k, i) => [k, vars.v_adds[i]] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const drops = vars.k_drops
    .map((k, i) => [k, vars.v_drops[i]] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  return makeKey([
    "proposeTrade",
    vars.league_id,
    adds,
    drops,
    [...(vars.draft_picks ?? [])].sort(),
    [...(vars.waiver_budget ?? [])].sort(),
    vars.reject_transaction_id ?? null,
    vars.reject_transaction_leg ?? null,
  ]);
}

/** Idempotency key for acceptTrade / rejectTrade (same shape). */
export function tradeActionKey(
  action: "acceptTrade" | "rejectTrade",
  vars: { league_id: string; transaction_id: string; leg: number },
): string {
  return makeKey([action, vars.league_id, vars.transaction_id, vars.leg]);
}

/** Idempotency key for createPoll. */
export function pollOperationKey(vars: {
  league_id: string;
  group_id: string;
  prompt: string;
  choices: string[];
  poll_type: string;
  privacy: string;
}): string {
  return makeKey([
    "createPoll",
    vars.league_id,
    vars.group_id,
    vars.prompt,
    vars.choices,
    vars.poll_type,
    vars.privacy,
  ]);
}

/** Idempotency key for createMessage. */
export function messageOperationKey(vars: {
  parent_id: string;
  text: string;
  attachment_type?: string;
  k_attachment_data?: string[];
  v_attachment_data?: string[];
}): string {
  return makeKey([
    "createMessage",
    vars.parent_id,
    vars.text,
    vars.attachment_type ?? null,
    vars.k_attachment_data ?? [],
    vars.v_attachment_data ?? [],
  ]);
}

/** Idempotency key for createDm (sorted members for determinism). */
export function dmOperationKey(vars: {
  members: string[];
  dm_type: string;
}): string {
  return makeKey(["createDm", [...vars.members].sort(), vars.dm_type]);
}

/** Idempotency key for createLeagueMessage. */
export function leagueMessageOperationKey(vars: {
  parent_id: string;
  text: string;
  attachment_type?: string;
  k_attachment_data?: string[];
  v_attachment_data?: string[];
}): string {
  return makeKey([
    "createLeagueMessage",
    vars.parent_id,
    vars.text,
    vars.attachment_type ?? null,
    vars.k_attachment_data ?? [],
    vars.v_attachment_data ?? [],
  ]);
}

/** Idempotency key for submitWaiverClaim. */
export function waiverSubmitOperationKey(vars: {
  league_id: string;
  k_adds: string[];
  v_adds: number[];
  k_drops?: string[];
  v_drops?: number[];
  k_settings?: string[];
  v_settings?: number[];
}): string {
  const adds = vars.k_adds
    .map((k, i) => [k, vars.v_adds[i]] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const drops = (vars.k_drops ?? [])
    .map((k, i) => [k, (vars.v_drops ?? [])[i]] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  return makeKey([
    "submitWaiverClaim",
    vars.league_id,
    adds,
    drops,
    vars.k_settings ?? [],
    vars.v_settings ?? [],
  ]);
}

/** Idempotency key for cancelWaiverClaim. */
export function waiverCancelOperationKey(vars: {
  league_id: string;
  transaction_id: string;
}): string {
  return makeKey(["cancelWaiverClaim", vars.league_id, vars.transaction_id]);
}
