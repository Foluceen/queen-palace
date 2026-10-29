import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir=new URL('../migrations/',import.meta.url);
  const files=(await readdir(dir)).filter(f=>/^\d+_.*\.sql$/.test(f)).sort();
  for (const file of files) {
    const version=file.replace(/\.sql$/,'');
    const exists=await pool.query('SELECT 1 FROM schema_migrations WHERE version=$1',[version]);
    if (exists.rowCount) { console.log(`migration ${version} already applied`); continue; }
    const client=await pool.connect();
    try { await client.query('BEGIN'); await client.query(await readFile(new URL(file,dir),'utf8')); await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]); await client.query('COMMIT'); console.log(`migration ${version} applied`); }
    catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }
} finally { await pool.end(); }
