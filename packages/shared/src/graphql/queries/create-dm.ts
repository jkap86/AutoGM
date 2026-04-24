import { gqlRequest } from "../client";
import type { CreateDmVars, CreateDmResult } from "./types";

const QUERY = `
  mutation create_dm(
    $members: [Snowflake],
    $dm_type: String!,
    $title: String
  ) {
    create_dm(
      members: $members,
      dm_type: $dm_type,
      title: $title
    ) {
      dm_id
      dm_type
      title
      last_message_id
      last_message_text
      last_message_time
    }
  }
`;

export async function createDm(
  vars: CreateDmVars,
): Promise<CreateDmResult> {
  return gqlRequest<CreateDmResult>(QUERY, vars, {
    operationName: "create_dm",
  });
}
