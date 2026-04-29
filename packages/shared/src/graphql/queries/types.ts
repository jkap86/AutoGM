// Pure types only — safe to import from any platform.

export type TransactionDraftPick = {
  round: number;
  season: string;
  roster_id: number;
  owner_id: number;
  previous_owner_id: number;
};

export type Transaction = {
  transaction_id: string;
  status: string;
  league_id: string;
  leg: number;
  consenter_ids: string[];
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: string[] | null;
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
  k_adds: string[];
  v_adds: number[];
  k_drops: string[];
  v_drops: number[];
  waiver_budget?: string[];
  draft_picks?: string[];
  reject_transaction_id?: string;
  reject_transaction_leg?: number;
  expires_at?: number;
};

export type ProposeTradeResult = {
  propose_trade: Transaction;
};

export type AcceptTradeVars = {
  league_id: string;
  transaction_id: string;
  leg: number;
};

export type AcceptTradeResult = {
  accept_trade: Transaction;
};

export type RejectTradeVars = {
  league_id: string;
  transaction_id: string;
  leg: number;
};

export type RejectTradeResult = {
  reject_trade: Transaction;
};

export type CreateMessageVars = {
  parent_id: string;
  text: string;
  attachment_type?: string;
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

export type CreatePollVars = {
  prompt: string;
  choices: string[];
  k_metadata: string[];
  v_metadata: string[];
};

export type Poll = {
  metadata: unknown;
  poll_id: string;
  prompt: string;
  choices: string[];
  choices_order: unknown;
  votes: unknown;
};

export type CreatePollResult = {
  create_poll: Poll;
};

export type CreatePollMessageVars = {
  parent_id: string;
  attachment_id: string;
  text: string;
};

export type CreatePollMessageResult = {
  create_message: Message;
};

export type ListPollVotesVars = {
  poll_id: string;
  limit?: number;
};

export type PollVote = {
  avatar: string | null;
  user_id: string;
  choice_id: string;
  name: string;
};

export type ListPollVotesResult = {
  list_poll_votes: PollVote[];
};

export type LeagueTransactionsVars = {
  league_id: string;
  status?: string;
  type?: string;
  limit?: number;
  roster_id?: number;
};

export type LeagueTransactionsResult = {
  league_transactions: Transaction[];
};

export type CreateLeagueMessageVars = {
  parent_id: string;
  text: string;
  attachment_type?: string;
  k_attachment_data?: string[];
  v_attachment_data?: string[];
};

export type MessagesVars = {
  parent_id: string;
  before?: string;
  order_by?: string;
};

export type MessagesResult = {
  messages: Message[];
};

export type CreateDmVars = {
  members: string[];
  dm_type: string;
  title?: string;
};

export type CreateDmResult = {
  create_dm: {
    dm_id: string;
    dm_type: string;
    title: string | null;
    last_message_id: string | null;
    last_message_text: string | null;
    last_message_time: number | null;
  };
};

export type LeaguePlayer = {
  player_id: string;
  league_id: string;
  metadata: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
};

export type LeaguePlayersVars = {
  league_id: string;
};

export type LeaguePlayersResult = {
  league_players: LeaguePlayer[];
};

export type SubmitWaiverClaimVars = {
  league_id: string;
  k_adds: string[];
  v_adds: number[];
  k_drops?: string[];
  v_drops?: number[];
  k_settings?: string[];
  v_settings?: number[];
};

export type SubmitWaiverClaimResult = {
  submit_waiver_claim: Transaction;
};

export type CancelWaiverClaimVars = {
  league_id: string;
  transaction_id: string;
};

export type CancelWaiverClaimResult = {
  cancel_waiver_claim: Transaction;
};

export type QueryMap = {
  proposeTrade: { vars: ProposeTradeVars; result: ProposeTradeResult };
  acceptTrade: { vars: AcceptTradeVars; result: AcceptTradeResult };
  rejectTrade: { vars: RejectTradeVars; result: RejectTradeResult };
  createDm: { vars: CreateDmVars; result: CreateDmResult };
  createMessage: { vars: CreateMessageVars; result: CreateMessageResult };
  getDmByMembers: { vars: GetDmByMembersVars; result: GetDmByMembersResult };
  createPoll: { vars: CreatePollVars; result: CreatePollResult };
  createPollMessage: {
    vars: CreatePollMessageVars;
    result: CreatePollMessageResult;
  };
  listPollVotes: { vars: ListPollVotesVars; result: ListPollVotesResult };
  leagueTransactions: {
    vars: LeagueTransactionsVars;
    result: LeagueTransactionsResult;
  };
  messages: { vars: MessagesVars; result: MessagesResult };
  leaguePlayers: { vars: LeaguePlayersVars; result: LeaguePlayersResult };
  createLeagueMessage: {
    vars: CreateLeagueMessageVars;
    result: CreateMessageResult;
  };
  submitWaiverClaim: {
    vars: SubmitWaiverClaimVars;
    result: SubmitWaiverClaimResult;
  };
  cancelWaiverClaim: {
    vars: CancelWaiverClaimVars;
    result: CancelWaiverClaimResult;
  };
};

export type QueryName = keyof QueryMap;
