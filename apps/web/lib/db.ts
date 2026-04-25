import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}
