import { gqlRequest } from "../client";
import type { MyDmsResult } from "./types";

const QUERY = `
  query my_dms {
    my_dms {
      dm_id dm_type last_message_text last_message_time
      last_author_display_name last_author_id recent_users
    }
  }
`;

export async function myDms(): Promise<MyDmsResult> {
  return gqlRequest<MyDmsResult>(QUERY, {}, { operationName: "my_dms" });
}
