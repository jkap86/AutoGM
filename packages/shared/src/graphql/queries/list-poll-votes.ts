import { gqlRequest } from "../client";
import type { ListPollVotesVars, ListPollVotesResult } from "./types";

const QUERY = `
  query list_poll_votes($poll_id: String!, $limit: Int) {
    list_poll_votes(poll_id: $poll_id, limit: $limit) {
      avatar user_id choice_id name
    }
  }
`;

export async function listPollVotes(
  vars: ListPollVotesVars,
): Promise<ListPollVotesResult> {
  return gqlRequest<ListPollVotesResult>(
    QUERY,
    { poll_id: vars.poll_id, limit: vars.limit ?? 200 },
    { operationName: "list_poll_votes" },
  );
}
