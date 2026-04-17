import path from "path";
import { app, ipcMain } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers/create-window";
import { launchPersistent } from "./helpers/launch-persistent";
import { fetchLeagues } from "./helpers/fetch-leagues";
import { setSession, getToken } from "./lib/auth";
import { configureClient, runQuery } from "@sleepier/shared";
import type { QueryMap, QueryName } from "@sleepier/shared";
import { fetchAllPlayers } from "./helpers/fetch-allplayers";
import { getPolls, addPoll, removePoll, removePollGroup } from "./lib/poll-store";
import type { StoredPoll } from "./lib/poll-store";
import { fetchKtcLatest, fetchKtcHistory, fetchKtcByDate } from "./helpers/fetch-ktc";
import { fetchAdp, fetchAdpStats } from "./helpers/fetch-adp";
import type { AdpFilters } from "./helpers/fetch-adp";

// Wire shared GraphQL client to desktop's auth token
configureClient({ getToken });

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

ipcMain.handle(
  "leagues:fetch",
  async (_event, args: { user_id: string; season: string }) => {
    return fetchLeagues(args);
  },
);

ipcMain.handle("allplayers:fetch", async () => {
  return fetchAllPlayers();
});

ipcMain.handle(
  "graphql",
  async (
    _event,
    args: { name: QueryName; vars: QueryMap[QueryName]["vars"] },
  ) => {
    return runQuery(args.name, args.vars as never);
  },
);

ipcMain.handle("polls:list", async () => {
  return getPolls();
});

ipcMain.handle("polls:add", async (_event, poll: StoredPoll) => {
  addPoll(poll);
});

ipcMain.handle("polls:remove", async (_event, pollId: string) => {
  removePoll(pollId);
});

ipcMain.handle("polls:remove-group", async (_event, groupId: string) => {
  removePollGroup(groupId);
});

ipcMain.handle("ktc:latest", async () => {
  return fetchKtcLatest();
});

ipcMain.handle("ktc:history", async (_event, args: { playerIds: string[]; days?: number }) => {
  return fetchKtcHistory(args.playerIds, args.days);
});

ipcMain.handle("ktc:byDate", async (_event, args: { date: string }) => {
  return fetchKtcByDate(args.date);
});

ipcMain.handle("adp:fetch", async (_event, filters: AdpFilters = {}) => {
  return fetchAdp(filters);
});

ipcMain.handle("adp:stats", async (_event, filters: AdpFilters = {}) => {
  return fetchAdpStats(filters);
});
