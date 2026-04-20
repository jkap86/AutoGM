type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'debug'

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL]
}

function format(level: LogLevel, tag: string, msg: string): string {
  const ts = new Date().toISOString()
  return `${ts} [${level.toUpperCase()}] [${tag}] ${msg}`
}

export default function createLogger(tag: string) {
  return {
    debug(msg: string, ...args: unknown[]) {
      if (shouldLog('debug')) console.debug(format('debug', tag, msg), ...args)
    },
    info(msg: string, ...args: unknown[]) {
      if (shouldLog('info')) console.log(format('info', tag, msg), ...args)
    },
    warn(msg: string, ...args: unknown[]) {
      if (shouldLog('warn')) console.warn(format('warn', tag, msg), ...args)
    },
    error(msg: string, ...args: unknown[]) {
      if (shouldLog('error')) console.error(format('error', tag, msg), ...args)
    },
  }
}
