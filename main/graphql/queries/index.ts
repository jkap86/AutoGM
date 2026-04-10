import { createMessage } from "./create-message";
import { createPoll } from "./create-poll";
import { createPollMessage } from "./create-poll-message";
import { getDmByMembers } from "./get-dm-by-members";
import { listPollVotes } from "./list-poll-votes";
import { proposeTrade } from "./propose-trade";
import type { QueryMap, QueryName } from "./types";

type QueryRegistry = {
  [K in QueryName]: (
    vars: QueryMap[K]["vars"],
  ) => Promise<QueryMap[K]["result"]>;
};

const queries: QueryRegistry = {
  proposeTrade,
  createMessage,
  getDmByMembers,
  createPoll,
  createPollMessage,
  listPollVotes,
};

export async function runQuery<N extends QueryName>(
  name: N,
  vars: QueryMap[N]["vars"],
): Promise<QueryMap[N]["result"]> {
  const fn = queries[name];
  if (!fn) throw new Error(`Unknown query: ${name}`);
  return fn(vars);
}
