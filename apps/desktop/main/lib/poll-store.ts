import Store from "electron-store";

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

type PollStoreSchema = {
  polls: StoredPoll[];
};

let _store: Store<PollStoreSchema> | null = null;

function getStore(): Store<PollStoreSchema> {
  if (!_store) {
    _store = new Store<PollStoreSchema>({
      name: "polls",
      defaults: { polls: [] },
    });
  }
  return _store;
}

export function getPolls(): StoredPoll[] {
  return getStore().get("polls");
}

export function addPoll(poll: StoredPoll): void {
  const polls = getStore().get("polls");
  const idx = polls.findIndex((p) => p.poll_id === poll.poll_id);
  if (idx !== -1) {
    polls[idx] = poll;
  } else {
    polls.push(poll);
  }
  getStore().set("polls", polls);
}

export function removePoll(pollId: string): void {
  const polls = getStore().get("polls").filter((p) => p.poll_id !== pollId);
  getStore().set("polls", polls);
}

export function removePollGroup(groupId: string): void {
  const polls = getStore().get("polls").filter((p) => p.group_id !== groupId);
  getStore().set("polls", polls);
}
