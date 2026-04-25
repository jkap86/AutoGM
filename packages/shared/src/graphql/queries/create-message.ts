import { gqlRequest } from "../client";
import { randomId } from "../../lib/random-id";
import type { CreateMessageVars, CreateMessageResult } from "./types";

const MUTATION = `
  mutation create_message(
    $parent_id: String!, $client_id: String!, $text: String,
    $attachment_type: String,
    $k_attachment_data: [String], $v_attachment_data: [String]
  ) {
    create_message(
      parent_id: $parent_id, client_id: $client_id, parent_type: "dm",
      text: $text, shard_min: null, shard_max: null,
      attachment_type: $attachment_type,
      k_attachment_data: $k_attachment_data,
      v_attachment_data: $v_attachment_data
    ) {
      attachment author_avatar author_display_name author_real_name
      author_id author_is_bot author_role_id client_id created
      message_id parent_id parent_type pinned reactions user_reactions
      text text_map
    }
  }
`;

export async function createMessage(
  vars: CreateMessageVars,
): Promise<CreateMessageResult> {
  return gqlRequest<CreateMessageResult>(
    MUTATION,
    {
      parent_id: vars.parent_id,
      client_id: randomId(),
      text: vars.text,
      attachment_type: vars.attachment_type,
      k_attachment_data: vars.k_attachment_data,
      v_attachment_data: vars.v_attachment_data,
    },
    { operationName: "create_message" },
  );
}
