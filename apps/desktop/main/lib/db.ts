import { Pool } from 'pg'
import { DATABASE_URL } from './env'
import createLogger from './logger'

const log = createLogger('db')

let _pool: Pool | null = null

export default function getPool(): Pool {
  if (!_pool) {
    if (!DATABASE_URL) {
      throw new Error('[db] DATABASE_URL is not set')
    }
    _pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
    _pool.on('error', (err) => {
      log.error('Unexpected error on idle client', err)
    })
  }
  return _pool
}
