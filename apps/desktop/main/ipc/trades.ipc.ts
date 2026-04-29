import { ipcMain } from "electron";
import { requireAccess } from "../lib/auth";
import { runQuery } from "@autogm/shared";
import type { QueryMap } from "@autogm/shared";
import {
  findBlockingRecord,
  recordOperation,
  tradeOperationKey,
  tradeActionKey,
} from "../lib/operation-store";

export function registerTradesIpc() {
  ipcMain.handle(
    "trade:propose",
    async (_event, vars: QueryMap["proposeTrade"]["vars"]) => {
      await requireAccess();
      const opKey = tradeOperationKey(vars);
      const existing = findBlockingRecord(opKey);
      if (existing) {
        throw new Error(
          `Duplicate trade blocked (status: ${existing.status}, transaction: ${existing.result_id})`,
        );
      }
      recordOperation(opKey, "pending");
      try {
        const result = await runQuery("proposeTrade", vars);
        const txId = result.propose_trade?.transaction_id ?? null;
        recordOperation(opKey, "success", txId);
        return result;
      } catch (err) {
        recordOperation(opKey, "failed");
        throw err;
      }
    },
  );

  ipcMain.handle(
    "trade:accept",
    async (_event, vars: QueryMap["acceptTrade"]["vars"]) => {
      await requireAccess();
      const opKey = tradeActionKey("acceptTrade", vars);
      const existing = findBlockingRecord(opKey);
      if (existing) {
        throw new Error(
          `Duplicate accept blocked (status: ${existing.status}, transaction: ${existing.result_id})`,
        );
      }
      recordOperation(opKey, "pending");
      try {
        const result = await runQuery("acceptTrade", vars);
        const txId = result.accept_trade?.transaction_id ?? null;
        recordOperation(opKey, "success", txId);
        return result;
      } catch (err) {
        recordOperation(opKey, "failed");
        throw err;
      }
    },
  );

  ipcMain.handle(
    "trade:reject",
    async (_event, vars: QueryMap["rejectTrade"]["vars"]) => {
      await requireAccess();
      const opKey = tradeActionKey("rejectTrade", vars);
      const existing = findBlockingRecord(opKey);
      if (existing) {
        throw new Error(
          `Duplicate reject blocked (status: ${existing.status}, transaction: ${existing.result_id})`,
        );
      }
      recordOperation(opKey, "pending");
      try {
        const result = await runQuery("rejectTrade", vars);
        const txId = result.reject_trade?.transaction_id ?? null;
        recordOperation(opKey, "success", txId);
        return result;
      } catch (err) {
        recordOperation(opKey, "failed");
        throw err;
      }
    },
  );
}
