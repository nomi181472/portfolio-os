/**
 * scripts/validate.ts
 *
 * `npm run validate [path]`
 *
 * Checks a content file before it becomes a commit. Three things are reported,
 * in descending severity:
 *
 *   1. Schema failures — the file will not load. Exit code 1.
 *   2. Warnings — it loads, but something is unreachable (duplicate slugs,
 *      an unexpected schemaVersion).
 *   3. Notices — references that point at entities which do not exist. These
 *      degrade gracefully in the UI (§68) but are almost always typos.
 *
 * Defaults to content/portfolio.json. Pass a path to check an export before
 * you push it to the data repository.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePortfolio, describeIssues } from '../lib/validate';
import { buildGraph } from '../lib/graph';

const target = resolve(process.cwd(), process.argv[2] ?? 'content/portfolio.json');

let text: string;
try {
  text = readFileSync(target, 'utf8');
} catch {
  console.error(`Could not read ${target}`);
  process.exit(1);
}

let parsed: unknown;
try {
  parsed = JSON.parse(text);
} catch (error) {
  console.error(`${target} is not valid JSON.`);
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const result = validatePortfolio(parsed);

if (!result.ok) {
  console.error(`${result.issues.length} problem(s) in ${target}:\n`);
  console.error(describeIssues(result.issues));
  process.exit(1);
}

const graph = buildGraph(result.data);
const counts = (Object.entries(result.data) as [string, unknown][])
  .flatMap(([key, value]) => (Array.isArray(value) ? [`${value.length} ${key}`] : []))
  .join(', ');

console.log(`✓ ${target} is valid against schema ${result.data.schemaVersion}.`);
console.log(`  ${counts}`);

for (const warning of result.warnings) console.warn(`! ${warning}`);
for (const notice of graph.warnings) console.warn(`· ${notice}`);

if (result.warnings.length === 0 && graph.warnings.length === 0) {
  console.log('  No dangling references.');
}
