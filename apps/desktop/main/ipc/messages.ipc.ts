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
import { requireString, requireStringArray } from "../lib/ipc-validation";

const MAX_MESSAGE_LENGTH = 10_000;

export function registerMessagesIpc() {
  ipcMain.handle(
    "message:create",
    async (_event, vars: QueryMap["createMessage"]["vars"]) => {
      await requireAccess();
      requireString(vars.parent_id, "parent_id");
      requireString(vars.text, "text");
      if (vars.text.length > MAX_MESSAGE_LENGTH) {
        throw new Error(`Message text exceeds maximum length of ${MAX_MESSAGE_LENGTH}`);
      }

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
      requireStringArray(vars.members, "members");
      if (vars.members.length < 2) {
        throw new Error("DM requires at least 2 members");
      }
      requireString(vars.dm_type, "dm_type");

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
      requireString(vars.parent_id, "parent_id");
      requireString(vars.text, "text");
      if (vars.text.length > MAX_MESSAGE_LENGTH) {
        throw new Error(`Message text exceeds maximum length of ${MAX_MESSAGE_LENGTH}`);
      }

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
