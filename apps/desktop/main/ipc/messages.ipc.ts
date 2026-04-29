import { ipcMain } from "electron";
import { requireAccess } from "../lib/auth";
import { runQuery } from "@autogm/shared";
import type { QueryMap } from "@autogm/shared";
import {
  findBlockingRecord,
  recordOperation,
  messageOperationKey,
  dmOperationKey,
  leagueMessageOperationKey,
} from "../lib/operation-store";

export function registerMessagesIpc() {
  ipcMain.handle(
    "message:create",
    async (_event, vars: QueryMap["createMessage"]["vars"]) => {
      await requireAccess();
      const opKey = messageOperationKey(vars);
      const existing = findBlockingRecord(opKey);
      if (existing) {
        throw new Error(
          `Duplicate message blocked (status: ${existing.status})`,
        );
      }
      recordOperation(opKey, "pending");
      try {
        const result = await runQuery("createMessage", vars);
        recordOperation(
          opKey,
          "success",
          result.create_message?.message_id ?? null,
        );
        return result;
      } catch (err) {
        recordOperation(opKey, "failed");
        throw err;
      }
    },
  );

  ipcMain.handle(
    "dm:create",
    async (_event, vars: QueryMap["createDm"]["vars"]) => {
      await requireAccess();
      const opKey = dmOperationKey(vars);
      const existing = findBlockingRecord(opKey);
      if (existing) {
        throw new Error(
          `Duplicate DM creation blocked (status: ${existing.status})`,
        );
      }
      recordOperation(opKey, "pending");
      try {
        const result = await runQuery("createDm", vars);
        recordOperation(opKey, "success", result.create_dm?.dm_id ?? null);
        return result;
      } catch (err) {
        recordOperation(opKey, "failed");
        throw err;
      }
    },
  );

  ipcMain.handle(
    "league-message:create",
    async (_event, vars: QueryMap["createLeagueMessage"]["vars"]) => {
      await requireAccess();
      const opKey = leagueMessageOperationKey(vars);
      const existing = findBlockingRecord(opKey);
      if (existing) {
        throw new Error(
          `Duplicate league message blocked (status: ${existing.status})`,
        );
      }
      recordOperation(opKey, "pending");
      try {
        const result = await runQuery("createLeagueMessage", vars);
        recordOperation(
          opKey,
          "success",
          result.create_message?.message_id ?? null,
        );
        return result;
      } catch (err) {
        recordOperation(opKey, "failed");
        throw err;
      }
    },
  );
}
