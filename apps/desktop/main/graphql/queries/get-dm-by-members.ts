import { gqlRequest } from "../client";
import type { GetDmByMembersVars, GetDmByMembersResult } from "./types";

const QUERY = `
  query get_dm_by_members($members: [String]!) {
    get_dm_by_members(members: $members) {
      dm_id
      dm_type
      hidden_at
      last_author_avatar
      last_author_display_name
      last_author_real_name
      last_author_id
      last_message_id
      last_message_text
      last_message_text_map
      last_message_time
      last_pinned_message_id
      last_read_id
      member_can_invite
      recent_users
      title
    }
  }
`;

export async function getDmByMembers(
  vars: GetDmByMembersVars,
): Promise<GetDmByMembersResult> {
  return gqlRequest<GetDmByMembersResult>(
    QUERY,
    { members: vars.members },
    { operationName: "get_dm_by_members" },
  );
}
