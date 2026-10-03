#!/usr/bin/env node
/**
 * Fails loudly when a running `next start` is serving a build other than the one on
 * disk.
 *
 * ## Why this exists
 *
 * `next start` reads `.next` when it boots and then keeps serving what it read. Build
 * over that directory afterwards and the process does not notice: it keeps answering
 * `/` with the old HTML, which references the old content-hashed chunks, which are
 * gone. The symptom is not a 500. The page loads, the shell renders, and then the
 * first interaction silently fails or a feature is simply absent — which during this
 * build looked exactly like "the agent widget is not mounted", and cost a long
 * detour into a DOM probe that was measuring the wrong server.
 *
 * It is silent because nothing in the response says the build is old. The build id is
 * embedded in the served HTML, so comparing it against `.next/BUILD_ID` turns a
 * confusing runtime mystery into a one-line diagnosis.
 *
 * ## Usage
 *
 *   node scripts/check-server-freshness.mjs [port]
 *
 * Defaults to port 3100. Exits 0 when fresh, 1 when stale or unreachable — an
 * unreachable server is reported separately from a stale one, because "no server" is
 * a different situation from "wrong server" and conflating them hides which it is.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const buildIdPath = join(here, '..', '.next', 'BUILD_ID');

const port = Number(process.argv[2] ?? 3100);
const origin = `http://localhost:${port}`;

async function main() {
  let expected;
  try {
    expected = (await readFile(buildIdPath, 'utf8')).trim();
  } catch {
    console.error(`✗ No build on disk at ${buildIdPath}. Run \`npm run build\` first.`);
    process.exit(1);
  }

  let html;
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      console.error(`✗ ${origin} answered ${response.status}. Not a usable server.`);
      process.exit(1);
    }
    html = await response.text();
  } catch (error) {
    console.error(`✗ Nothing answering on ${origin} (${error.message}).`);
    console.error('  If that is expected, this check has nothing to say — start the server first.');
    process.exit(1);
  }

  // Next embeds the build id in the RSC payload on the App Router. If a future
  // version stops doing so, say so rather than reporting a false mismatch.
  if (!html.includes(expected)) {
    console.error(
      `✗ ${origin} is serving a build whose id is not ${expected}, or no longer embeds one.`,
    );
    console.error('  Restart the server:  pkill -f next-server && npm run start');
    process.exit(1);
  }

  // The build id matching is necessary but not sufficient: a server can hold the
  // right id while a chunk it references has been replaced. Check one real chunk,
  // because that is the failure a reader actually sees.
  const chunk = html.match(/\/_next\/static\/chunks\/[^"'\\]+\.js/)?.[0];
  if (chunk) {
    const chunkResponse = await fetch(`${origin}${chunk}`, { signal: AbortSignal.timeout(10_000) });
    if (!chunkResponse.ok) {
      console.error(`✗ ${origin} references ${chunk} but serves ${chunkResponse.status} for it.`);
      console.error('  The build directory changed under a running server. Restart it.');
      process.exit(1);
    }
  }

  console.log(`✓ ${origin} is serving the build on disk (${expected}).`);
}

await main();