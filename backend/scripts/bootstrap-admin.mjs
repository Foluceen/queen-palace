#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';
import pg from 'pg';
import argon2 from 'argon2';

let pipedLines;
function ask(prompt, hidden = false) {
  if (!input.isTTY) {
    if (!pipedLines) pipedLines = fs.readFileSync(0, 'utf8').split(/\r?\n/);
    if (!hidden) output.write(prompt);
    return Promise.resolve(pipedLines.shift() ?? '');
  }
  if (!hidden) return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input, output });
    rl.question(prompt).then((answer) => { rl.close(); resolve(answer); }, reject);
  });
  if (!input.isTTY) return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input });
    rl.once('line', (answer) => { rl.close(); resolve(answer); });
    rl.once('error', reject);
  });
  return new Promise((resolve, reject) => {
    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    let value = '';
    const onData = (chunk) => {
      const text = chunk.toString('utf8');
      for (const ch of text) {
        if (ch === '\u0003') { cleanup(); reject(new Error('cancelled')); return; }
        if (ch === '\r' || ch === '\n') { cleanup(); output.write('\n'); resolve(value); return; }
        if (ch === '\u007f') { value = value.slice(0, -1); continue; }
        if (ch >= ' ') value += ch;
      }
    };
    const cleanup = () => { input.off('data', onData); input.setRawMode(false); input.pause(); };
    input.on('data', onData);
  });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error('DATABASE_URL is not set'); process.exit(2); }
let pool;
try {
  const email = (await ask('Admin email: ')).trim().toLowerCase();
  const password = await ask('Admin password (input hidden): ', true);
  const confirm = await ask('Confirm admin password (input hidden): ', true);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('invalid email');
  if (password.length < 12) throw new Error('password must be at least 12 characters');
  if (password !== confirm) throw new Error('passwords do not match');
  pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const existing = await pool.query('SELECT id FROM staff LIMIT 1');
  if (existing.rowCount) throw new Error('an admin/staff account already exists; refusing to overwrite it');
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  await pool.query('INSERT INTO staff(email,password_hash,name,role,status) VALUES($1,$2,$3,$4,$5)', [email, hash, 'Queen Luxury Hair Owner', 'owner', 'active']);
  console.log('Admin owner created. Log in through the dashboard and change the password immediately.');
} catch (error) {
  console.error(`Admin bootstrap refused: ${error instanceof Error ? error.message : 'operation failed'}`);
  process.exitCode = 1;
} finally { await pool?.end(); }
