import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { chromium, Page } from 'playwright-core'

export function resolveProfileDir(): string {
  const dir = path.join(app.getPath('userData'), 'playwright-profile')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export async function launchPersistent(): Promise<Page> {
  const profileDir = resolveProfileDir()
  const channel = process.env.PW_CHANNEL || 'chrome'

  const context = await chromium.launchPersistentContext(profileDir, {
    channel,
    headless: false,
    viewport: null,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=BlockThirdPartyCookies',
    ],
  })

  const loginUrl = process.env.LOGIN_URL || 'https://sleeper.com/login'
  const page = await context.newPage()
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' })

  return page
}
