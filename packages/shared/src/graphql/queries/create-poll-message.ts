import { gqlRequest } from "../client";
import type { CreatePollMessageVars, CreatePollMessageResult } from "./types";

const MUTATION = `
  mutation create_message(
    $parent_id: String!, $client_id: String!,
    $text: String, $attachment_id: String
  ) {
    create_message(
      parent_id: $parent_id, client_id: $client_id,
      parent_type: "league", text: $text,
      attachment_type: "poll", attachment_id: $attachment_id
    ) {
      attachment author_avatar author_display_name author_real_name
      author_id author_is_bot author_role_id client_id created
      message_id parent_id parent_type pinned reactions user_reactions
      text text_map
    }
  }
`;

export async function createPollMessage(
  vars: CreatePollMessageVars,
): Promise<CreatePollMessageResult> {
  return gqlRequest<CreatePollMessageResult>(
    MUTATION,
    {
      parent_id: vars.parent_id,
      client_id: crypto.randomUUID(),
      text: vars.text,
      attachment_id: vars.attachment_id,
    },
    { operationName: "create_message" },
  );
}
