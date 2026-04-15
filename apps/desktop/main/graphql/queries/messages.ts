import { gqlRequest } from "../client";
import type { MessagesVars, MessagesResult } from "./types";

const QUERY = `
  query messages($parent_id: String!, $before: String, $order_by: String) {
    messages(parent_id: $parent_id, before: $before, order_by: $order_by) {
      attachment author_avatar author_display_name author_real_name
      author_id author_is_bot author_role_id client_id created
      message_id parent_id parent_type pinned reactions user_reactions
      text text_map
    }
  }
`;

export async function messages(
  vars: MessagesVars,
): Promise<MessagesResult> {
  return gqlRequest<MessagesResult>(QUERY, vars, {
    operationName: "messages",
  });
}
