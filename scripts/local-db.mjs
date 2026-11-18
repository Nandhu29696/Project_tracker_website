#!/usr/bin/env node
/**
 * Project-local PostgreSQL for running without Docker.
 * Uses an installed PostgreSQL's binaries (PG_BIN or auto-detected) and keeps
 * its data in ./.pgdata, listening on DB_HOST_PORT (default 5433).
 *
 *   node scripts/local-db.mjs init     # create cluster + role + database (once)
 *   node scripts/local-db.mjs start | stop | status
 *
 * Delete ./.pgdata to remove it completely.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dataDir = join(root, '.pgdata');
const logFile = join(root, '.pgdata.log');

function loadEnv() {
  const env = {};
  const file = join(root, '.env');
  if (!existsSync(file)) throw new Error('.env not found - copy .env.example to .env first');
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return env;
}

function findPgBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const candidates = [];
  if (process.platform === 'win32') {
    const base = 'C:\\Program Files\\PostgreSQL';
    if (existsSync(base)) {
      for (const v of readdirSync(base).sort((a, b) => Number(b) - Number(a))) {
        candidates.push(join(base, v, 'bin'));
      }
    }
  } else {
    candidates.push(
      '/usr/lib/postgresql/17/bin',
      '/usr/lib/postgresql/16/bin',
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
    );
  }
  const exe = process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl';
  const found = candidates.find((d) => existsSync(join(d, exe)));
  if (!found)
    throw new Error('PostgreSQL binaries not found. Set PG_BIN to the folder containing pg_ctl.');
  return found;
}

const env = loadEnv();
const port = env.DB_HOST_PORT || '5433';
const bin = findPgBin();
const tool = (name) => join(bin, process.platform === 'win32' ? `${name}.exe` : name);

function pgCtl(args, opts = {}) {
  return spawnSync(tool('pg_ctl'), ['-D', dataDir, ...args], { encoding: 'utf8', ...opts });
}

function isRunning() {
  return pgCtl(['status']).status === 0;
}

function start() {
  if (isRunning()) return console.log(`PostgreSQL already running on port ${port}`);
  // stdio must be ignored: on Windows the server inherits pg_ctl's handles, so a
  // captured pipe would never close and this script would hang.
  const r = pgCtl(
    ['-l', logFile, '-o', `-p ${port} -c listen_addresses=localhost`, '-w', 'start'],
    {
      stdio: 'ignore',
    },
  );
  if (r.status !== 0 || !isRunning()) throw new Error(`pg_ctl start failed - see ${logFile}`);
  console.log(`PostgreSQL started on localhost:${port} (data: .pgdata)`);
}

function stop() {
  if (!isRunning()) return console.log('PostgreSQL is not running');
  pgCtl(['-m', 'fast', '-w', 'stop'], { stdio: 'inherit' });
}

function init() {
  if (existsSync(join(dataDir, 'PG_VERSION'))) {
    console.log('.pgdata already initialised');
  } else {
    const pwFile = join(tmpdir(), `pt-pw-${process.pid}`);
    writeFileSync(pwFile, env.DB_PASSWORD, { mode: 0o600 });
    try {
      execFileSync(
        tool('initdb'),
        [
          '-D',
          dataDir,
          '-U',
          env.DB_USER,
          `--pwfile=${pwFile}`,
          '-A',
          'scram-sha-256',
          '-E',
          'UTF8',
          '--locale=C',
        ],
        { stdio: 'inherit' },
      );
    } finally {
      rmSync(pwFile, { force: true });
    }
  }
  start();
  const psqlEnv = { ...process.env, PGPASSWORD: env.DB_PASSWORD };
  const exists = execFileSync(
    tool('psql'),
    [
      '-h',
      'localhost',
      '-p',
      port,
      '-U',
      env.DB_USER,
      '-d',
      'postgres',
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname='${env.DB_NAME}'`,
    ],
    { env: psqlEnv, encoding: 'utf8' },
  ).trim();
  if (exists !== '1') {
    execFileSync(
      tool('createdb'),
      ['-h', 'localhost', '-p', port, '-U', env.DB_USER, env.DB_NAME],
      { env: psqlEnv, stdio: 'inherit' },
    );
    console.log(`Created database ${env.DB_NAME}`);
  } else {
    console.log(`Database ${env.DB_NAME} already exists`);
  }
}

const cmd = process.argv[2];
try {
  if (cmd === 'init') init();
  else if (cmd === 'start') start();
  else if (cmd === 'stop') stop();
  else if (cmd === 'status') console.log(isRunning() ? `running on port ${port}` : 'stopped');
  else console.log('usage: node scripts/local-db.mjs <init|start|stop|status>');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
