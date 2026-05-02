import { ipcMain } from "electron";
import { requireAccess } from "../lib/auth";
import { runQuery } from "@autogm/shared";
import type { QueryMap, QueryName } from "@autogm/shared";

/** Generic queries allowed through the generic GraphQL channel. */
const GENERIC_GRAPHQL_QUERIES = new Set<QueryName>([
  "inboundRequests",
  "getDmByMembers",
  "leaguePlayers",
  "leagueTransactions",
  "messages",
  "listPollVotes",
  "myDms",
]);

/** Errors that are expected and should not be logged to console. */
const SILENT_ERRORS = ["doesn't seem to exist"];

export function registerReadonlyGraphqlIpc() {
  ipcMain.handle(
    "graphql",
    async (
      _event,
      args: { name: QueryName; vars: QueryMap[QueryName]["vars"] },
    ) => {
      await requireAccess();

      if (!GENERIC_GRAPHQL_QUERIES.has(args.name)) {
        throw new Error(`"${args.name}" is not allowed on the generic GraphQL channel`);
      }

      try {
        return await runQuery(args.name as QueryName, args.vars as QueryMap[typeof args.name]["vars"]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (!SILENT_ERRORS.some((s) => msg.includes(s))) {
          console.error(`Error in graphql handler (${args.name}):`, msg);
        }
        throw err;
      }
    },
  );
}
