import { ipcMain } from "electron";
import { requireAccess } from "../lib/auth";
import type { AdpFilters } from "../helpers/fetch-adp";

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
      const { fetchKtcHistory } = await import("../helpers/fetch-ktc");
      return fetchKtcHistory(args.playerIds, args.days);
    },
  );

  ipcMain.handle("ktc:byDate", async (_event, args: { date: string }) => {
    await requireAccess();
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
      const { fetchOpponentTrades } = await import(
        "../helpers/fetch-opponent-trades"
      );
      return fetchOpponentTrades(args);
    },
  );
}
