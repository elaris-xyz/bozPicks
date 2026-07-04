import { Pool } from 'pg';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var _db: Pool | undefined;
}

export const db = globalThis._db ?? new Pool({ connectionString: env.DATABASE_URL });
if (process.env.NODE_ENV !== 'production') globalThis._db = db;
