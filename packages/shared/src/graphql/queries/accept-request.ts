import { gqlRequest } from "../client";
import type { AcceptRequestVars, AcceptRequestResult } from "./types";

const QUERY = `
  mutation accept_request($request_type: String!, $requester_id: Snowflake!, $type_id: Snowflake!) {
    accept_request(request_type: $request_type, requester_id: $requester_id, type_id: $type_id)
  }
`;

export async function acceptRequest(
  vars: AcceptRequestVars,
): Promise<AcceptRequestResult> {
  return gqlRequest<AcceptRequestResult>(QUERY, vars, {
    operationName: "accept_request",
  });
}
