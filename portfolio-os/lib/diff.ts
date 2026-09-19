/**
 * lib/diff.ts
 *
 * Structural diff between canonical content and the local draft (§56). The
 * point is confidence before export: you should be able to see exactly what
 * you changed, by path, before you paste JSON into a repository.
 */

export type ChangeType = 'added' | 'modified' | 'removed';

export interface Change {
  type: ChangeType;
  path: string;
  before?: unknown;
  after?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function diff(before: unknown, after: unknown, path = ''): Change[] {
  if (before === after) return [];

  if (Array.isArray(before) && Array.isArray(after)) {
    const changes: Change[] = [];
    const max = Math.max(before.length, after.length);
    for (let i = 0; i < max; i += 1) {
      const next = `${path}[${i}]`;
      if (i >= before.length) changes.push({ type: 'added', path: next, after: after[i] });
      else if (i >= after.length) changes.push({ type: 'removed', path: next, before: before[i] });
      else changes.push(...diff(before[i], after[i], next));
    }
    return changes;
  }

  if (isObject(before) && isObject(after)) {
    const changes: Change[] = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const next = path ? `${path}.${key}` : key;
      if (!(key in before)) changes.push({ type: 'added', path: next, after: after[key] });
      else if (!(key in after)) changes.push({ type: 'removed', path: next, before: before[key] });
      else changes.push(...diff(before[key], after[key], next));
    }
    return changes;
  }

  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  return [{ type: 'modified', path: path || '(root)', before, after }];
}

export function summarise(changes: Change[]): string {
  if (changes.length === 0) return 'No changes';
  const counts = changes.reduce<Record<ChangeType, number>>(
    (acc, change) => ({ ...acc, [change.type]: acc[change.type] + 1 }),
    { added: 0, modified: 0, removed: 0 },
  );
  const parts: string[] = [];
  if (counts.modified) parts.push(`${counts.modified} changed`);
  if (counts.added) parts.push(`${counts.added} added`);
  if (counts.removed) parts.push(`${counts.removed} removed`);
  return parts.join(', ');
}
