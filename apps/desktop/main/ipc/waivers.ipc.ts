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
import {
  requireString,
  requirePairedArrays,
  requirePairedStringArrays,
  requireNonNegativeInt,
} from "../lib/ipc-validation";

function validateSubmitWaiver(vars: QueryMap["submitWaiverClaim"]["vars"]) {
  requireString(vars.league_id, "league_id");
  requirePairedArrays(vars.k_adds, vars.v_adds, "k_adds", "v_adds");

  if (vars.k_drops?.length || vars.v_drops?.length) {
    requirePairedArrays(vars.k_drops!, vars.v_drops!, "k_drops", "v_drops");
  }

  if (vars.k_settings?.length || vars.v_settings?.length) {
    requirePairedStringArrays(
      vars.k_settings ?? [],
      vars.v_settings ?? [],
      "k_settings",
      "v_settings",
    );

    // Validate waiver_bid specifically
    const bidIdx = (vars.k_settings ?? []).indexOf("waiver_bid");
    if (bidIdx !== -1 && vars.v_settings) {
      requireNonNegativeInt(vars.v_settings[bidIdx], "waiver_bid");
    }
  }
}

export function registerWaiversIpc() {
  ipcMain.handle(
    "waiver:submit",
    async (_event, vars: QueryMap["submitWaiverClaim"]["vars"]) => {
      await requireAccess();
      validateSubmitWaiver(vars);

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
      requireString(vars.league_id, "league_id");
      requireString(vars.transaction_id, "transaction_id");

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
