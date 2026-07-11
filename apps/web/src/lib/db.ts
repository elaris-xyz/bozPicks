import { Pool } from 'pg';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var _db: Pool | undefined;
}

// connectionTimeoutMillis stops db.connect() (used by vault transactions) from
// hanging forever if the pool is momentarily saturated during settlement.
export const db = globalThis._db ?? new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 8000,
});
if (process.env.NODE_ENV !== 'production') globalThis._db = db;
