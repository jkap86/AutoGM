import { Pool } from 'pg'
import createLogger from './logger'

const log = createLogger('db')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('[db] DATABASE_URL is not set. See .env.example')
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

pool.on('error', (err) => {
  log.error('Unexpected error on idle client', err)
})

export default pool
