export type StoredPoll = {
  poll_id: string;
  group_id: string;
  league_id: string;
  prompt: string;
  choices: string[];
  choices_order: string[];
  poll_type: string;
  privacy: string;
  created_at: number;
};
