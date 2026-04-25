import Store from "electron-store";
import crypto from "crypto";

type OperationRecord = {
  key: string;
  result_id: string | null;
  created_at: number;
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
 * Check if an operation was recently executed.
 * Returns the existing result_id if duplicate, or null if new.
 */
export function findRecent(key: string): string | null {
  const ops = prune();
  const found = ops.find((o) => o.key === key);
  return found?.result_id ?? null;
}

/** Record a completed operation. */
export function recordOperation(key: string, resultId: string | null): void {
  const ops = prune();
  const idx = ops.findIndex((o) => o.key === key);
  const record: OperationRecord = {
    key,
    result_id: resultId,
    created_at: Date.now(),
  };
  if (idx !== -1) {
    ops[idx] = record;
  } else {
    ops.push(record);
  }
  getStore().set("operations", ops);
}

/** Build an idempotency key for a proposeTrade mutation. */
export function tradeOperationKey(vars: {
  league_id: string;
  k_adds: string[];
  v_adds: number[];
  k_drops: string[];
  v_drops: number[];
  draft_picks?: string[];
  waiver_budget?: string[];
}): string {
  return makeKey([
    "proposeTrade",
    vars.league_id,
    [...vars.k_adds].sort(),
    [...vars.v_adds].sort(),
    [...vars.k_drops].sort(),
    [...vars.v_drops].sort(),
    [...(vars.draft_picks ?? [])].sort(),
    [...(vars.waiver_budget ?? [])].sort(),
  ]);
}

/** Build an idempotency key for a createPoll mutation. */
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
