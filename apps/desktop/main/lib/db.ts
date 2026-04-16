import { Pool } from 'pg'

const DATABASE_URL = 'postgresql://postgres:password123@localhost:5432/thelab_dev'

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err)
})

export default pool
