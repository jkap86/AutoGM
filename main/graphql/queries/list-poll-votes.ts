import { gqlRequest } from "../client";
import type { ListPollVotesVars, ListPollVotesResult } from "./types";

function buildQuery(pollId: string, limit: number): string {
  return `
    query list_poll_votes {
      list_poll_votes(poll_id: "${pollId}", limit: ${limit}) {
        avatar
        user_id
        choice_id
        name
      }
    }
  `;
}

export async function listPollVotes(
  vars: ListPollVotesVars,
): Promise<ListPollVotesResult> {
  return gqlRequest<ListPollVotesResult>(
    buildQuery(vars.poll_id, vars.limit ?? 200),
    {},
    { operationName: "list_poll_votes" },
  );
}
