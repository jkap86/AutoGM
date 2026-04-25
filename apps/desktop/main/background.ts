import "dotenv/config";
import path from "path";
import { app, ipcMain } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers/create-window";
import { launchPersistent } from "./helpers/launch-persistent";
import { fetchLeagues } from "./helpers/fetch-leagues";
import { setSession, getSession, getToken, requireAccess, restoreSession, clearSession } from "./lib/auth";
import { configureClient, runQuery } from "@sleepier/shared";
import type { QueryMap, QueryName } from "@sleepier/shared";
import { fetchAllPlayers } from "./helpers/fetch-allplayers";
import { getPolls, addPoll, removePoll, removePollGroup } from "./lib/poll-store";
import type { AdpFilters } from "./helpers/fetch-adp";
import { checkAccess } from "./lib/access";
import {
  findRecentRecord,
  recordOperation,
  tradeOperationKey,
  pollOperationKey,
} from "./lib/operation-store";

// Wire shared GraphQL client to desktop's auth token
configureClient({ getToken });

const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  serve({ directory: "app" });
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`);
}

// Restore persisted session after userData path is set
restoreSession();

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

ipcMain.handle("logout", async () => {
  clearSession();
  return { ok: true };
});

ipcMain.handle("access:check", async () => {
  const session = getSession();
  if (!session?.user_id) {
    return { allowed: false };
  }
  return checkAccess(session.user_id);
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

const BLOCKED_GRAPHQL_QUERIES = new Set<QueryName>(["createPoll", "createPollMessage"]);

ipcMain.handle(
  "graphql",
  async (
    _event,
    args: { name: QueryName; vars: QueryMap[QueryName]["vars"] },
  ) => {
    await requireAccess();

    if (BLOCKED_GRAPHQL_QUERIES.has(args.name)) {
      throw new Error(`"${args.name}" must be called via its dedicated IPC route`);
    }

    // Idempotency guard for proposeTrade
    if (args.name === "proposeTrade") {
      const vars = args.vars as QueryMap["proposeTrade"]["vars"];
      const opKey = tradeOperationKey(vars);
      const existing = findRecentRecord(opKey);
      if (existing) {
        throw new Error(`Duplicate trade blocked (status: ${existing.status}, transaction: ${existing.result_id})`);
      }
      recordOperation(opKey, "pending");
      try {
        const result = await runQuery(args.name, args.vars as never);
        const txId = (result as QueryMap["proposeTrade"]["result"]).propose_trade?.transaction_id ?? null;
        recordOperation(opKey, "success", txId);
        return result;
      } catch (err) {
        recordOperation(opKey, "failed");
        throw err;
      }
    }

    return runQuery(args.name, args.vars as never);
  },
);

ipcMain.handle(
  "polls:create",
  async (
    _event,
    args: {
      prompt: string;
      choices: string[];
      poll_type: string;
      privacy: string;
      group_id: string;
      league_id: string;
      text?: string;
    },
  ) => {
    await requireAccess();

    const opKey = pollOperationKey({
      league_id: args.league_id,
      group_id: args.group_id,
      prompt: args.prompt,
      choices: args.choices,
      poll_type: args.poll_type,
      privacy: args.privacy,
    });
    const existing = findRecentRecord(opKey);
    if (existing) {
      throw new Error(`Duplicate poll blocked (status: ${existing.status}, poll: ${existing.result_id})`);
    }

    recordOperation(opKey, "pending");

    let poll_id: string;
    try {
      const pollResult = await runQuery("createPoll", {
        prompt: args.prompt,
        choices: args.choices,
        k_metadata: ["poll_type", "privacy"],
        v_metadata: [args.poll_type, args.privacy],
      });

      poll_id = pollResult.create_poll.poll_id;

      // Record success immediately so a retry cannot create another remote poll
      recordOperation(opKey, "success", poll_id);

      addPoll({
        poll_id,
        group_id: args.group_id,
        league_id: args.league_id,
        prompt: args.prompt,
        choices: args.choices,
        choices_order: pollResult.create_poll.choices_order as string[],
        poll_type: args.poll_type,
        privacy: args.privacy,
        created_at: Date.now(),
      });
    } catch (err) {
      recordOperation(opKey, "failed");
      throw err;
    }

    const messageResult = await runQuery("createPollMessage", {
      parent_id: args.league_id,
      attachment_id: poll_id,
      text: args.text ?? "",
    });

    return { poll_id, message: messageResult };
  },
);

ipcMain.handle("polls:list", async () => {
  await requireAccess();
  return getPolls();
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
