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
  findBlockingRecord,
  findRecentRecord,
  recordOperation,
  tradeOperationKey,
  tradeActionKey,
  pollOperationKey,
  messageOperationKey,
  dmOperationKey,
  leagueMessageOperationKey,
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

const BLOCKED_GRAPHQL_QUERIES = new Set<QueryName>([
  "createPoll",
  "createPollMessage",
  "proposeTrade",
  "acceptTrade",
  "rejectTrade",
  "createMessage",
  "createDm",
  "createLeagueMessage",
]);

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

    return runQuery(args.name, args.vars as never);
  },
);

const VALID_POLL_TYPES = new Set(["single", "multiple"]);
const VALID_POLL_PRIVACY = new Set(["public", "anonymous"]);

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

    // Normalize and validate
    const prompt = (args.prompt ?? "").trim();
    const choices = (args.choices ?? []).map((c) => c.trim()).filter(Boolean);
    const poll_type = (args.poll_type ?? "single").trim();
    const privacy = (args.privacy ?? "public").trim();
    const group_id = (args.group_id ?? "").trim();
    const league_id = (args.league_id ?? "").trim();
    const text = (args.text ?? "").trim();

    if (!prompt) throw new Error("Poll prompt is required");
    if (choices.length < 2) throw new Error("At least 2 choices required");
    if (!league_id) throw new Error("league_id is required");
    if (!group_id) throw new Error("group_id is required");
    if (!VALID_POLL_TYPES.has(poll_type)) throw new Error(`Invalid poll_type: "${poll_type}" (expected: single, multiple)`);
    if (!VALID_POLL_PRIVACY.has(privacy)) throw new Error(`Invalid privacy: "${privacy}" (expected: public, anonymous)`);

    const opKey = pollOperationKey({
      league_id,
      group_id,
      prompt,
      choices,
      poll_type,
      privacy,
    });

    // If the poll was already created remotely but createPollMessage failed,
    // skip createPoll and retry only the message step.
    const prior = findRecentRecord(opKey);
    if (prior?.status === "poll_created" && prior.result_id) {
      // Ensure the local poll record exists (may have been lost if the
      // process crashed between createPoll and addPoll)
      const stored = getPolls();
      if (!stored.some((p) => p.poll_id === prior.result_id)) {
        addPoll({
          poll_id: prior.result_id,
          group_id,
          league_id,
          prompt,
          choices,
          choices_order: [],
          poll_type,
          privacy,
          created_at: prior.created_at,
        });
      }

      const messageResult = await runQuery("createPollMessage", {
        parent_id: league_id,
        attachment_id: prior.result_id,
        text,
      });
      recordOperation(opKey, "success", prior.result_id);
      return { poll_id: prior.result_id, message: messageResult };
    }

    const blocking = findBlockingRecord(opKey);
    if (blocking) {
      throw new Error(`Duplicate poll blocked (status: ${blocking.status}, poll: ${blocking.result_id})`);
    }

    recordOperation(opKey, "pending");

    let poll_id: string;
    try {
      // Sleeper API uses "multi" not "multiple"
      const sleeperPollType = poll_type === "multiple" ? "multi" : poll_type;
      const pollResult = await runQuery("createPoll", {
        prompt,
        choices,
        k_metadata: ["poll_type", "privacy"],
        v_metadata: [sleeperPollType, privacy],
      });

      poll_id = pollResult.create_poll.poll_id;

      // Record poll_created so a retry skips createPoll and only retries
      // createPollMessage
      recordOperation(opKey, "poll_created", poll_id);

      addPoll({
        poll_id,
        group_id,
        league_id,
        prompt,
        choices,
        choices_order: pollResult.create_poll.choices_order as string[],
        poll_type,
        privacy,
        created_at: Date.now(),
      });
    } catch (err) {
      recordOperation(opKey, "failed");
      throw err;
    }

    const messageResult = await runQuery("createPollMessage", {
      parent_id: league_id,
      attachment_id: poll_id,
      text,
    });

    recordOperation(opKey, "success", poll_id);

    return { poll_id, message: messageResult };
  },
);

// ---- Dedicated mutation routes ----

ipcMain.handle(
  "trade:propose",
  async (_event, vars: QueryMap["proposeTrade"]["vars"]) => {
    await requireAccess();
    const opKey = tradeOperationKey(vars);
    const existing = findBlockingRecord(opKey);
    if (existing) {
      throw new Error(`Duplicate trade blocked (status: ${existing.status}, transaction: ${existing.result_id})`);
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
      throw new Error(`Duplicate accept blocked (status: ${existing.status}, transaction: ${existing.result_id})`);
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
      throw new Error(`Duplicate reject blocked (status: ${existing.status}, transaction: ${existing.result_id})`);
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

ipcMain.handle(
  "message:create",
  async (_event, vars: QueryMap["createMessage"]["vars"]) => {
    await requireAccess();
    const opKey = messageOperationKey(vars);
    const existing = findBlockingRecord(opKey);
    if (existing) {
      throw new Error(`Duplicate message blocked (status: ${existing.status})`);
    }
    recordOperation(opKey, "pending");
    try {
      const result = await runQuery("createMessage", vars);
      recordOperation(opKey, "success", result.create_message?.message_id ?? null);
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
    const opKey = dmOperationKey(vars);
    const existing = findBlockingRecord(opKey);
    if (existing) {
      throw new Error(`Duplicate DM creation blocked (status: ${existing.status})`);
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
    const opKey = leagueMessageOperationKey(vars);
    const existing = findBlockingRecord(opKey);
    if (existing) {
      throw new Error(`Duplicate league message blocked (status: ${existing.status})`);
    }
    recordOperation(opKey, "pending");
    try {
      const result = await runQuery("createLeagueMessage", vars);
      recordOperation(opKey, "success", result.create_message?.message_id ?? null);
      return result;
    } catch (err) {
      recordOperation(opKey, "failed");
      throw err;
    }
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
