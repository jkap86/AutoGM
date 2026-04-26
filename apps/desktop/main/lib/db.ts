import { Pool } from 'pg'
import createLogger from './logger'

const log = createLogger('db')

let _pool: Pool | null = null

export default function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL
    if (!url) {
      throw new Error('[db] DATABASE_URL is not set. See .env.example')
    }
    _pool = new Pool({
      connectionString: url,
      ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
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
