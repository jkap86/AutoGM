import path from "path";

// In dev, load .env from the desktop app root.
// In production, env vars are baked in at build time via DefinePlugin.
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
}

import { app, ipcMain } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers/create-window";
import { getToken, restoreSession } from "./lib/auth";
import { configureClient } from "@autogm/shared";

// IPC route modules
import { registerAuthIpc } from "./ipc/auth.ipc";
import { registerReadonlyGraphqlIpc } from "./ipc/readonly-graphql.ipc";
import { registerTradesIpc } from "./ipc/trades.ipc";
import { registerWaiversIpc } from "./ipc/waivers.ipc";
import { registerPollsIpc } from "./ipc/polls.ipc";
import { registerMessagesIpc } from "./ipc/messages.ipc";
import { registerResearchIpc } from "./ipc/research.ipc";

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

// Register all IPC handlers
registerAuthIpc();
registerReadonlyGraphqlIpc();
registerTradesIpc();
registerWaiversIpc();
registerPollsIpc();
registerMessagesIpc();
registerResearchIpc();

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
