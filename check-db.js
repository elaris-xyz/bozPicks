// Reads DATABASE_URL from the environment — never hard-code credentials.
// Run with: DATABASE_URL="postgresql://…" node check-db.js
const { Pool } = require('./apps/ingest/node_modules/pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set DATABASE_URL first, e.g. DATABASE_URL="postgresql://…" node check-db.js');
  process.exit(1);
}
const db = new Pool({ connectionString });
db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
  .then(r => {
    const tables = r.rows.map(x => x.table_name);
    if (tables.length === 0) {
      console.log('No tables found — migration did not run yet');
    } else {
      console.log('Tables found:', tables.join(', '));
    }
    db.end();
  })
  .catch(e => { console.error('Error:', e.message); db.end(); });
