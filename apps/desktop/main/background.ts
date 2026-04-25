import "dotenv/config";
import path from "path";
import { app, ipcMain } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers/create-window";
import { launchPersistent } from "./helpers/launch-persistent";
import { fetchLeagues } from "./helpers/fetch-leagues";
import { setSession, getToken, requireAccess, restoreSession } from "./lib/auth";
import { configureClient, runQuery } from "@sleepier/shared";
import type { QueryMap, QueryName } from "@sleepier/shared";
import { fetchAllPlayers } from "./helpers/fetch-allplayers";
import { getPolls, addPoll, removePoll, removePollGroup } from "./lib/poll-store";
import type { StoredPoll } from "./lib/poll-store";
import type { AdpFilters } from "./helpers/fetch-adp";
import { checkAccess } from "./lib/access";

// Wire shared GraphQL client to desktop's auth token
configureClient({ getToken });

// Restore persisted session so the app doesn't lose auth on reload
restoreSession();


const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  serve({ directory: "app" });
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`);
}

(async () => {
  await app.whenReady();

  const mainWindow = createWindow("main", {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isProd) {
    await mainWindow.loadURL("app://./");
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/`);
    mainWindow.webContents.openDevTools();
  }
})();

app.on("window-all-closed", () => {
  app.quit();
});

ipcMain.on("message", async (event, arg) => {
  event.reply("message", `${arg} World!`);
});

ipcMain.handle("login", async () => {
  const page = await launchPersistent();
  try {
    await page.waitForFunction(
      () =>
        !!localStorage.getItem("token") && !!localStorage.getItem("user_id"),
      null,
      { timeout: 0, polling: 500 },
    );
    const token = await page.evaluate(() => localStorage.getItem("token"));
    const user_id = await page.evaluate(() => localStorage.getItem("user_id"));
    if (token && user_id) {
      setSession({ token, user_id });
    }
    return { token, user_id };
  } finally {
    await page.context().close();
  }
});

ipcMain.handle("session:restore", async () => {
  const session = restoreSession();
  return session;
});

ipcMain.handle("access:check", async (_event, args: { user_id: string }) => {
  return checkAccess(args.user_id);
});

ipcMain.handle(
  "leagues:fetch",
  async (_event, args: { user_id: string; season: string }) => {
    const session = await requireAccess();
    if (args.user_id !== session.user_id) {
      throw new Error("Cannot fetch leagues for another user");
    }
    return fetchLeagues(args);
  },
);

ipcMain.handle("allplayers:fetch", async () => {
  await requireAccess();
  return fetchAllPlayers();
});

ipcMain.handle(
  "graphql",
  async (
    _event,
    args: { name: QueryName; vars: QueryMap[QueryName]["vars"] },
  ) => {
    await requireAccess();
    return runQuery(args.name, args.vars as never);
  },
);

ipcMain.handle("polls:list", async () => {
  await requireAccess();
  return getPolls();
});

ipcMain.handle("polls:add", async (_event, poll: StoredPoll) => {
  await requireAccess();
  addPoll(poll);
});

ipcMain.handle("polls:remove", async (_event, pollId: string) => {
  await requireAccess();
  removePoll(pollId);
});

ipcMain.handle("polls:remove-group", async (_event, groupId: string) => {
  await requireAccess();
  removePollGroup(groupId);
});

ipcMain.handle("ktc:latest", async () => {
  await requireAccess();
  const { fetchKtcLatest } = await import("./helpers/fetch-ktc");
  return fetchKtcLatest();
});

ipcMain.handle("ktc:history", async (_event, args: { playerIds: string[]; days?: number }) => {
  await requireAccess();
  const { fetchKtcHistory } = await import("./helpers/fetch-ktc");
  return fetchKtcHistory(args.playerIds, args.days);
});

ipcMain.handle("ktc:byDate", async (_event, args: { date: string }) => {
  await requireAccess();
  const { fetchKtcByDate } = await import("./helpers/fetch-ktc");
  return fetchKtcByDate(args.date);
});

ipcMain.handle("adp:fetch", async (_event, filters: AdpFilters = {}) => {
  await requireAccess();
  const { fetchAdp } = await import("./helpers/fetch-adp");
  return fetchAdp(filters);
});

ipcMain.handle("adp:stats", async (_event, filters: AdpFilters = {}) => {
  await requireAccess();
  const { fetchAdpStats } = await import("./helpers/fetch-adp");
  return fetchAdpStats(filters);
});

ipcMain.handle("opponent:drafts", async (_event, args: { userId: string }) => {
  await requireAccess();
  const { fetchOpponentDrafts } = await import("./helpers/fetch-opponent-drafts");
  return fetchOpponentDrafts(args.userId);
});

ipcMain.handle("opponent:trades", async (_event, args: { opponentUserId: string; playerIds: string[]; season?: string }) => {
  await requireAccess();
  const { fetchOpponentTrades } = await import("./helpers/fetch-opponent-trades");
  return fetchOpponentTrades(args);
});
