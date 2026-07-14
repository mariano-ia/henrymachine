// Lector: imprime contenido de la DB con voseo (para el barrido a voz peruana).
// Uso: node --env-file=.env.local scripts/vquery.mjs
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error("Falta SUPABASE_DB_URL"); process.exit(1); }

const VOSEO = "(Caminá|Caminás|Elegí|Elegís|Empezá|Empezás|Empezalo|Probá|Pedí|Poné|Ponelo|Entrá|Vení|Volvé|Mirá|Fijate|Contá|Contanos|Contame|Guardá|Guardalo|Dejá|Dejame|Tomá|Tomate|Seguí|Mandá|Mandame|Buscá|Cargá|Avisá|Avisame|Escribí|Escribile|Sacá|Reviví|Compartí|Cruzá|Llevá|Quedate|Desbloqueá|arrancás|arrancá|tenés|querés|podés|sabés|hacés|venís|dale|Dale)";
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

async function scan(table, idcol, cols, label) {
  const conds = cols.map((c) => `coalesce("${c}",'') ~ '\\m${VOSEO}\\M'`).join(" OR ");
  const sel = cols.map((c) => `"${c}"`).join(", ");
  const re = new RegExp(VOSEO); // sin \b: los acentos rompen los word-boundaries de JS
  const { rows } = await client.query(`SELECT "${idcol}" AS id, ${sel} FROM "${table}" WHERE ${conds}`);
  for (const r of rows) {
    for (const c of cols) {
      const v = r[c];
      if (v && re.test(v)) {
        console.log(`\n[${label}] id=${r.id} · campo=${c}`);
        console.log(`  ${v.replace(/\s+/g, " ").slice(0, 400)}`);
      }
    }
  }
  return rows.length;
}

try {
  let total = 0;
  total += await scan("experiences", "slug", ["title", "pitch", "henry_tip", "upsell_message"], "EXP");
  total += await scan("steps", "id", ["title", "body", "arrive_script", "proposal", "payoff", "walk_to_next", "paywall_message", "orientation_hint"], "STEP");
  total += await scan("utilities", "id", ["name", "henry_note"], "UTIL");
  console.log(`\n==== filas con voseo: ${total} ====`);
} finally {
  await client.end();
}
