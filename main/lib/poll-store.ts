import Store from "electron-store";

export type StoredPoll = {
  poll_id: string;
  league_id: string;
  prompt: string;
  choices: string[];
  choices_order: string[];
  poll_type: string;
  privacy: string;
  created_at: number;
};

type PollStoreSchema = {
  polls: StoredPoll[];
};

const store = new Store<PollStoreSchema>({
  name: "polls",
  defaults: { polls: [] },
});

export function getPolls(): StoredPoll[] {
  return store.get("polls");
}

export function addPoll(poll: StoredPoll): void {
  const polls = store.get("polls");
  polls.push(poll);
  store.set("polls", polls);
}

export function removePoll(pollId: string): void {
  const polls = store.get("polls").filter((p) => p.poll_id !== pollId);
  store.set("polls", polls);
}
