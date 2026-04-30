import { gqlRequest } from "../client";
import type { InboundRequestsVars, InboundRequestsResult } from "./types";

const QUERY = `
  query inbound_requests($request_type: String!) {
    inbound_requests(request_type: $request_type) {
      requester_id request_type type_id requester_display_name requester_avatar
    }
  }
`;

export async function inboundRequests(
  vars: InboundRequestsVars,
): Promise<InboundRequestsResult> {
  return gqlRequest<InboundRequestsResult>(QUERY, vars, {
    operationName: "inbound_requests",
  });
}
