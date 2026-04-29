import { ipcMain } from "electron";
import { requireAccess } from "../lib/auth";
import { runQuery } from "@autogm/shared";
import type { QueryMap, QueryName } from "@autogm/shared";

/** Read-only queries allowed through the generic GraphQL channel. */
const READONLY_GRAPHQL_QUERIES = new Set<QueryName>([
  "getDmByMembers",
  "leaguePlayers",
  "leagueTransactions",
  "messages",
  "listPollVotes",
]);

export function registerReadonlyGraphqlIpc() {
  ipcMain.handle(
    "graphql",
    async (
      _event,
      args: { name: QueryName; vars: QueryMap[QueryName]["vars"] },
    ) => {
      await requireAccess();

      if (!READONLY_GRAPHQL_QUERIES.has(args.name)) {
        throw new Error(`"${args.name}" must use a dedicated IPC route`);
      }

      return runQuery(args.name, args.vars as never);
    },
  );
}
