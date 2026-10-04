import 'server-only';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Reads the starter skeleton JSON for the CopyHub component.
 */
export function getStarterJson(): string {
  const path = join(process.cwd(), 'content/starter.json');
  return readFileSync(path, 'utf8');
}

/**
 * Reads the sample config template for the CopyHub component.
 */
export function getStarterConfig(): string {
  const path = join(process.cwd(), 'content/starter.config.txt');
  return readFileSync(path, 'utf8');
}
