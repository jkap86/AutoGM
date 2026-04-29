import { ipcMain } from "electron";
import { launchPersistent } from "../helpers/launch-persistent";
import {
  setSession,
  getSession,
  restoreSession,
  clearSession,
  requireAccess,
} from "../lib/auth";
import { checkAccess } from "../lib/access";
import { fetchLeagues } from "../helpers/fetch-leagues";
import { fetchAllPlayers } from "../helpers/fetch-allplayers";

export function registerAuthIpc() {
  ipcMain.handle("login", async () => {
    let page;
    try {
      page = await launchPersistent();

      await page.waitForFunction(
        () =>
          !!localStorage.getItem("token") &&
          !!localStorage.getItem("user_id"),
        null,
        { timeout: 120_000, polling: 500 },
      );

      const token = await page.evaluate(() => localStorage.getItem("token"));
      const user_id = await page.evaluate(
        () => localStorage.getItem("user_id"),
      );

      if (!token || !user_id) {
        throw new Error(
          "Sleeper login completed but token/user_id was missing.",
        );
      }

      setSession({ token, user_id });
      return { token, user_id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.toLowerCase().includes("executable")) {
        throw new Error(
          "Chrome is required for login but was not found. Install Chrome or set PW_CHANNEL to another browser.",
        );
      }

      if (message.includes("Timeout")) {
        throw new Error("Login timed out after 2 minutes. Please try again.");
      }

      throw err;
    } finally {
      await page?.context().close().catch(() => {});
    }
  });

  ipcMain.handle("session:restore", async () => {
    return restoreSession();
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
}
