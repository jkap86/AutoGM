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
import {
  requireString,
  requirePositiveInt,
  requirePairedArrays,
} from "../lib/ipc-validation";

function validateProposeTrade(vars: QueryMap["proposeTrade"]["vars"]) {
  requireString(vars.league_id, "league_id");
  requirePairedArrays(vars.k_adds, vars.v_adds, "k_adds", "v_adds");
  requirePairedArrays(vars.k_drops, vars.v_drops, "k_drops", "v_drops");

  if (vars.draft_picks != null && !Array.isArray(vars.draft_picks)) {
    throw new Error("draft_picks must be an array");
  }
  if (vars.waiver_budget != null && !Array.isArray(vars.waiver_budget)) {
    throw new Error("waiver_budget must be an array");
  }
  if (vars.expires_at != null) {
    if (!Number.isFinite(vars.expires_at) || vars.expires_at <= 0) {
      throw new Error("expires_at must be a positive number");
    }
  }
}

function validateTradeAction(vars: { league_id: string; transaction_id: string; leg: number }) {
  requireString(vars.league_id, "league_id");
  requireString(vars.transaction_id, "transaction_id");
  requirePositiveInt(vars.leg, "leg");
}

export function registerTradesIpc() {
  ipcMain.handle(
    "trade:propose",
    async (_event, vars: QueryMap["proposeTrade"]["vars"]) => {
      await requireAccess();
      validateProposeTrade(vars);
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
      validateTradeAction(vars);
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
      validateTradeAction(vars);
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
