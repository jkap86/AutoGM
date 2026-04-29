import { ipcMain } from "electron";
import { requireAccess } from "../lib/auth";
import { runQuery } from "@autogm/shared";
import type { QueryMap } from "@autogm/shared";
import {
  findBlockingRecord,
  recordOperation,
  waiverSubmitOperationKey,
  waiverCancelOperationKey,
} from "../lib/operation-store";

export function registerWaiversIpc() {
  ipcMain.handle(
    "waiver:submit",
    async (_event, vars: QueryMap["submitWaiverClaim"]["vars"]) => {
      await requireAccess();

      if (!vars.league_id) throw new Error("league_id is required");
      if (!vars.k_adds?.length) throw new Error("k_adds is required");
      if (vars.k_adds.length !== vars.v_adds?.length) {
        throw new Error("k_adds and v_adds must have the same length");
      }
      if ((vars.k_drops?.length ?? 0) !== (vars.v_drops?.length ?? 0)) {
        throw new Error("k_drops and v_drops must have the same length");
      }

      const opKey = waiverSubmitOperationKey(vars);
      const existing = findBlockingRecord(opKey);
      if (existing) {
        throw new Error(
          `Duplicate waiver claim blocked (status: ${existing.status}, transaction: ${existing.result_id})`,
        );
      }
      recordOperation(opKey, "pending");
      try {
        const result = await runQuery("submitWaiverClaim", vars);
        const txId = result.submit_waiver_claim?.transaction_id ?? null;
        recordOperation(opKey, "success", txId);
        return result;
      } catch (err) {
        recordOperation(opKey, "failed");
        throw err;
      }
    },
  );

  ipcMain.handle(
    "waiver:cancel",
    async (_event, vars: QueryMap["cancelWaiverClaim"]["vars"]) => {
      await requireAccess();

      if (!vars.league_id) throw new Error("league_id is required");
      if (!vars.transaction_id) throw new Error("transaction_id is required");

      const opKey = waiverCancelOperationKey(vars);
      const existing = findBlockingRecord(opKey);
      if (existing) {
        throw new Error(
          `Duplicate waiver cancel blocked (status: ${existing.status}, transaction: ${existing.result_id})`,
        );
      }
      recordOperation(opKey, "pending");
      try {
        const result = await runQuery("cancelWaiverClaim", vars);
        const txId = result.cancel_waiver_claim?.transaction_id ?? null;
        recordOperation(opKey, "success", txId);
        return result;
      } catch (err) {
        recordOperation(opKey, "failed");
        throw err;
      }
    },
  );
}
