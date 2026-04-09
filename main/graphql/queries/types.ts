// Pure types only — safe to import from the renderer.
// Do NOT import any runtime modules here (electron-store, fetch wrappers, etc.)
// or they will get pulled into the renderer bundle.

// Returned by trade-related mutations.
export type Transaction = {
  transaction_id: string;
  status: string;
  league_id: string;
  leg: number;
  consenter_ids: string[];
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: unknown[];
  waiver_budget: unknown[];
  player_map: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created: number;
  creator: string;
  status_updated: number;
  type: string;
  settings: Record<string, unknown> | null;
};

export type ProposeTradeVars = {
  league_id: string;
  // Parallel arrays: k_adds[i] is the player_id moving to roster v_adds[i].
  k_adds: string[];
  v_adds: number[];
  // Parallel arrays: k_drops[i] is the player_id leaving roster v_drops[i].
  k_drops: string[];
  v_drops: number[];
  // Optional — sleeper expects these as string[] entries.
  waiver_budget?: string[];
  draft_picks?: string[];
};

export type ProposeTradeResult = {
  propose_trade: Transaction;
};

export type QueryMap = {
  proposeTrade: { vars: ProposeTradeVars; result: ProposeTradeResult };
};

export type QueryName = keyof QueryMap;
