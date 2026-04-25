import { contextBridge, ipcRenderer } from 'electron'

/**
 * Whitelisted IPC channels — only these can be invoked from the renderer.
 * Any channel not in this set is silently blocked.
 */
const ALLOWED_CHANNELS = new Set([
  'login',
  'access:check',
  'session:restore',
  'logout',
  'leagues:fetch',
  'allplayers:fetch',
  'graphql',
  'polls:create',
  'polls:list',
  'polls:remove',
  'polls:remove-group',
  'ktc:latest',
  'ktc:history',
  'ktc:byDate',
  'adp:fetch',
  'adp:stats',
  'trade:propose',
  'trade:accept',
  'trade:reject',
  'message:create',
  'dm:create',
  'league-message:create',
  'opponent:drafts',
  'opponent:trades',
])

const handler = {
  invoke<TResult = unknown, TArg = unknown>(
    channel: string,
    value?: TArg
  ): Promise<TResult> {
    if (!ALLOWED_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`IPC channel "${channel}" is not allowed`))
    }
    return ipcRenderer.invoke(channel, value)
  },
}

contextBridge.exposeInMainWorld('ipc', handler)

export type IpcHandler = typeof handler
