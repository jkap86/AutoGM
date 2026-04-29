import { ipcMain } from "electron";
import { requireAccess } from "../lib/auth";
import type { AdpFilters } from "../helpers/fetch-adp";
import {
  requireString,
  requireStringArray,
  requireDateString,
} from "../lib/ipc-validation";

export function registerResearchIpc() {
  ipcMain.handle("ktc:latest", async () => {
    await requireAccess();
    const { fetchKtcLatest } = await import("../helpers/fetch-ktc");
    return fetchKtcLatest();
  });

  ipcMain.handle(
    "ktc:history",
    async (_event, args: { playerIds: string[]; days?: number }) => {
      await requireAccess();
      requireStringArray(args.playerIds, "playerIds");
      if (args.days != null) {
        if (!Number.isInteger(args.days) || args.days <= 0 || args.days > 365) {
          throw new Error("days must be an integer between 1 and 365");
        }
      }
      const { fetchKtcHistory } = await import("../helpers/fetch-ktc");
      return fetchKtcHistory(args.playerIds, args.days);
    },
  );

  ipcMain.handle("ktc:byDate", async (_event, args: { date: string }) => {
    await requireAccess();
    requireDateString(args.date, "date");
    const { fetchKtcByDate } = await import("../helpers/fetch-ktc");
    return fetchKtcByDate(args.date);
  });

  ipcMain.handle("adp:fetch", async (_event, filters: AdpFilters = {}) => {
    await requireAccess();
    const { fetchAdp } = await import("../helpers/fetch-adp");
    return fetchAdp(filters);
  });

  ipcMain.handle("adp:stats", async (_event, filters: AdpFilters = {}) => {
    await requireAccess();
    const { fetchAdpStats } = await import("../helpers/fetch-adp");
    return fetchAdpStats(filters);
  });

  ipcMain.handle(
    "opponent:drafts",
    async (_event, args: { userId: string }) => {
      await requireAccess();
      requireString(args.userId, "userId");
      const { fetchOpponentDrafts } = await import(
        "../helpers/fetch-opponent-drafts"
      );
      return fetchOpponentDrafts(args.userId);
    },
  );

  ipcMain.handle(
    "opponent:trades",
    async (
      _event,
      args: {
        opponentUserId: string;
        playerIds: string[];
        season?: string;
      },
    ) => {
      await requireAccess();
      requireString(args.opponentUserId, "opponentUserId");
      requireStringArray(args.playerIds, "playerIds");
      if (args.season != null) {
        requireString(args.season, "season");
      }
      const { fetchOpponentTrades } = await import(
        "../helpers/fetch-opponent-trades"
      );
      return fetchOpponentTrades(args);
    },
  );
}
