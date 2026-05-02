import { acceptRequest } from "./accept-request";
import { inboundRequests } from "./inbound-requests";
import { acceptTrade } from "./accept-trade";
import { createDm } from "./create-dm";
import { createLeagueMessage } from "./create-league-message";
import { createMessage } from "./create-message";
import { createPoll } from "./create-poll";
import { createPollMessage } from "./create-poll-message";
import { getDmByMembers } from "./get-dm-by-members";
import { leaguePlayers } from "./league-players";
import { leagueTransactions } from "./league-transactions";
import { listPollVotes } from "./list-poll-votes";
import { messages } from "./messages";
import { proposeTrade } from "./propose-trade";
import { rejectTrade } from "./reject-trade";
import { submitWaiverClaim } from "./submit-waiver-claim";
import { cancelWaiverClaim } from "./cancel-waiver-claim";
import { myDms } from "./my-dms";
import type { QueryMap, QueryName } from "./types";

type QueryRegistry = {
  [K in QueryName]: (
    vars: QueryMap[K]["vars"],
  ) => Promise<QueryMap[K]["result"]>;
};

const queries: QueryRegistry = {
  acceptRequest,
  inboundRequests,
  proposeTrade,
  acceptTrade,
  rejectTrade,
  createDm,
  createLeagueMessage,
  createMessage,
  getDmByMembers,
  createPoll,
  createPollMessage,
  listPollVotes,
  leaguePlayers,
  leagueTransactions,
  messages,
  submitWaiverClaim,
  cancelWaiverClaim,
  myDms,
};

export async function runQuery<N extends QueryName>(
  name: N,
  vars: QueryMap[N]["vars"],
): Promise<QueryMap[N]["result"]> {
  const fn = queries[name];
  if (!fn) throw new Error(`Unknown query: ${name}`);
  return fn(vars);
}
