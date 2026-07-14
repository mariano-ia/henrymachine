// Runner de migraciones: node --env-file=.env.local scripts/db-run.mjs <archivo.sql> [...]
// Requiere SUPABASE_DB_URL en .env.local (connection string del dashboard).
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error("Falta SUPABASE_DB_URL en .env.local"); process.exit(1); }
const files = process.argv.slice(2);
if (!files.length) { console.error("Uso: db-run.mjs <migración.sql> [...]"); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
for (const f of files) {
  const sql = readFileSync(f, "utf8");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log(`✓ ${f}`);
  } catch (e) {
    await client.query("rollback");
    console.error(`✗ ${f}: ${e.message}`);
    process.exitCode = 1;
    break;
  }
}
await client.end();
