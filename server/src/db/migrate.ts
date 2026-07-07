import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../migrations',
);

/** 按文件名顺序应用 migrations/*.sql,幂等(_migrations 表记账)。 */
export async function migrate(pool: Pool): Promise<void> {
  await pool.query(
    'create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())',
  );
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const { rowCount } = await pool.query(
      'select 1 from _migrations where name = $1',
      [file],
    );
    if (rowCount) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into _migrations (name) values ($1)', [file]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }
}
