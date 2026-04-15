import { gqlRequest } from "../client";
import type { CreatePollVars, CreatePollResult } from "./types";

const mutation = `
  mutation create_poll(
    $prompt: String
    $choices: [String]
    $k_metadata: [String]
    $v_metadata: [String]
  ) {
    create_poll(
      prompt: $prompt
      choices: $choices
      k_metadata: $k_metadata
      v_metadata: $v_metadata
    ) {
      metadata
      poll_id
      prompt
      choices
      choices_order
      votes
    }
  }
`;

export async function createPoll(
  vars: CreatePollVars,
): Promise<CreatePollResult> {
  return gqlRequest<CreatePollResult>(mutation, vars, {
    operationName: "create_poll",
  });
}
