import { randomUUID } from "node:crypto";
import { gqlRequest } from "../client";
import type { CreatePollMessageVars, CreatePollMessageResult } from "./types";

function buildMutation(
  parentId: string,
  clientId: string,
  attachmentId: string,
): string {
  return `
    mutation create_message($text: String) {
      create_message(
        parent_id: "${parentId}",
        client_id: "${clientId}",
        parent_type: "league",
        text: $text,
        attachment_type: "poll",
        attachment_id: "${attachmentId}"
      ) {
        attachment
        author_avatar
        author_display_name
        author_real_name
        author_id
        author_is_bot
        author_role_id
        client_id
        created
        message_id
        parent_id
        parent_type
        pinned
        reactions
        user_reactions
        text
        text_map
      }
    }
  `;
}

export async function createPollMessage(
  vars: CreatePollMessageVars,
): Promise<CreatePollMessageResult> {
  return gqlRequest<CreatePollMessageResult>(
    buildMutation(vars.parent_id, randomUUID(), vars.attachment_id),
    { text: vars.text },
    { operationName: "create_message" },
  );
}
