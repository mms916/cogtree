import pg from 'pg'
import type { QueryResultRow } from 'pg'

import { config } from '../config.js'

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
})

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params)
}
