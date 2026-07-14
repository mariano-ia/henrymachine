import pg from "pg";
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public' AND data_type IN ('text','character varying')
  ORDER BY table_name, ordinal_position`);
let cur = "";
for (const r of rows) {
  if (r.table_name !== cur) { cur = r.table_name; process.stdout.write(`\n${cur}: `); }
  process.stdout.write(`${r.column_name} `);
}
console.log();
await client.end();
