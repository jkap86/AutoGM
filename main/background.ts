import path from 'path'
import { app, ipcMain } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers/create-window'
import { launchPersistent } from './helpers/launch-persistent'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

;(async () => {
  await app.whenReady()

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/`)
    mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})

ipcMain.handle('login', async () => {
  const page = await launchPersistent()
  try {
    await page.waitForFunction(
      () => !!localStorage.getItem('token') && !!localStorage.getItem('user_id'),
      null,
      { timeout: 0, polling: 500 }
    )
    const token = await page.evaluate(() => localStorage.getItem('token'))
    const user_id = await page.evaluate(() => localStorage.getItem('user_id'))
    return { token, user_id }
  } finally {
    await page.context().close()
  }
})
