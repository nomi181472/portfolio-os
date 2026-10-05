/**
 * scripts/check-index.ts
 *
 * Runs before `next build`.
 * If portfolio.db and public/data/vectors.json already exist (committed to git),
 * skips expensive model downloads and exits immediately for fast, zero-compute
 * Vercel deployment.
 *
 * If missing, triggers lightweight fallback indexing without downloading heavy
 * embedding weights so Vercel builds never time out.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const DB_PATH = resolve(process.cwd(), 'portfolio.db');
const VECTORS_PATH = resolve(process.cwd(), 'public/data/vectors.json');

if (existsSync(DB_PATH) && existsSync(VECTORS_PATH)) {
  console.log('⚡ Found pre-built portfolio.db and public/data/vectors.json.');
  console.log('   Skipping build-time model downloads and embeddings on CI/Vercel.');
  process.exit(0);
}

console.log('⚠️  portfolio.db or vectors.json missing. Running fallback indexing (FTS5 text only)...');
execSync('node_modules/.bin/tsx scripts/index-portfolio.ts', {
  stdio: 'inherit',
  env: { ...process.env, VERCEL: '1' },
});
