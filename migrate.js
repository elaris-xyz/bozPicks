// Applies a SQL migration file. Reads DATABASE_URL from env.
// Usage: DATABASE_URL="postgresql://…" node migrate.js docs/db/002_rich_stats.sql
const fs = require('fs');
const { Pool } = require('./apps/ingest/node_modules/pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) { console.error('Set DATABASE_URL'); process.exit(1); }
const file = process.argv[2];
if (!file) { console.error('Pass a .sql file path'); process.exit(1); }

const sql = fs.readFileSync(file, 'utf8');
const db = new Pool({ connectionString });
db.query(sql)
  .then(() => { console.log(`Applied ${file}`); return db.end(); })
  .catch(e => { console.error('Migration failed:', e.message); db.end(); process.exit(1); });
