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

export type CreateMessageVars = {
  parent_id: string;
  text: string;
  k_attachment_data: string[];
  v_attachment_data: string[];
};

export type Message = {
  attachment: unknown;
  author_avatar: string | null;
  author_display_name: string;
  author_real_name: string | null;
  author_id: string;
  author_is_bot: boolean;
  author_role_id: string | null;
  client_id: string;
  created: number;
  message_id: string;
  parent_id: string;
  parent_type: string;
  pinned: boolean;
  reactions: unknown;
  user_reactions: unknown;
  text: string;
  text_map: unknown;
};

export type CreateMessageResult = {
  create_message: Message;
};

export type GetDmByMembersVars = {
  members: string[];
};

export type DmConversation = {
  dm_id: string;
  dm_type: string;
  hidden_at: number | null;
  last_author_avatar: string | null;
  last_author_display_name: string | null;
  last_author_real_name: string | null;
  last_author_id: string | null;
  last_message_id: string | null;
  last_message_text: string | null;
  last_message_text_map: unknown;
  last_message_time: number | null;
  last_pinned_message_id: string | null;
  last_read_id: string | null;
  member_can_invite: boolean;
  recent_users: unknown;
  title: string | null;
};

export type GetDmByMembersResult = {
  get_dm_by_members: DmConversation;
};

export type QueryMap = {
  proposeTrade: { vars: ProposeTradeVars; result: ProposeTradeResult };
  createMessage: { vars: CreateMessageVars; result: CreateMessageResult };
  getDmByMembers: { vars: GetDmByMembersVars; result: GetDmByMembersResult };
};

export type QueryName = keyof QueryMap;
