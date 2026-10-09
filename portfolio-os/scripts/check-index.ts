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

import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const PORTFOLIO_PATH = resolve(process.cwd(), 'content/portfolio.json');
const DB_PATH = resolve(process.cwd(), 'portfolio.db');
const VECTORS_PATH = resolve(process.cwd(), 'public/data/vectors.json');

const filesExist = existsSync(DB_PATH) && existsSync(VECTORS_PATH);
const isFresh =
  filesExist &&
  existsSync(PORTFOLIO_PATH) &&
  statSync(DB_PATH).mtimeMs >= statSync(PORTFOLIO_PATH).mtimeMs &&
  statSync(VECTORS_PATH).mtimeMs >= statSync(PORTFOLIO_PATH).mtimeMs;

if (isFresh) {
  console.log('⚡ Found up-to-date portfolio.db and public/data/vectors.json.');
  console.log('   Skipping build-time model downloads and embeddings on CI/Vercel.');
  process.exit(0);
}

if (!filesExist) {
  console.log('⚠️  portfolio.db or vectors.json missing. Running fallback indexing (FTS5 text only)...');
} else {
  console.log('🔄 content/portfolio.json has changed since last index. Running indexing...');
}
execSync('node_modules/.bin/tsx scripts/index-portfolio.ts', {
  stdio: 'inherit',
  env: { ...process.env, VERCEL: '1' },
});
