/**
 * lib/validate.ts
 *
 * Turns Zod failures into messages a person can act on (§59). "Invalid JSON" is
 * never an acceptable output; every issue names a path and says what was
 * expected there.
 */
import { PortfolioSchema, SCHEMA_VERSION } from '@/lib/schema';
import type { Portfolio } from '@/types/portfolio';

export interface ValidationIssue {
  /** Dotted/bracketed path, e.g. `products[2].links[0].url`. */
  path: string;
  message: string;
  /** What the parser saw, truncated. Helps when the value is a typo. */
  received?: string;
}

export type ValidationResult =
  | { ok: true; data: Portfolio; warnings: string[] }
  | { ok: false; issues: ValidationIssue[] };

function formatPath(path: (string | number)[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc ? `${acc}.${segment}` : segment;
  }, '');
}

function truncate(value: unknown, max = 60): string | undefined {
  if (value === undefined) return undefined;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === undefined) return undefined;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function validatePortfolio(input: unknown): ValidationResult {
  const parsed = PortfolioSchema.safeParse(input);

  if (!parsed.success) {
    const issues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
      path: formatPath(issue.path as (string | number)[]) || '(root)',
      message: issue.message,
      received: 'received' in issue ? truncate((issue as { received?: unknown }).received) : undefined,
    }));
    return { ok: false, issues };
  }

  const warnings: string[] = [];
  const data = parsed.data;

  if (data.schemaVersion !== SCHEMA_VERSION) {
    warnings.push(
      `Content declares schemaVersion ${data.schemaVersion}; this build expects ${SCHEMA_VERSION}. It was loaded with the current schema — check lib/migrate.ts if fields look wrong.`,
    );
  }

  // Duplicate slugs silently break routing, so surface them early.
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue;
    const seen = new Map<string, number>();
    value.forEach((item: unknown, index: number) => {
      const record = item as { slug?: string };
      if (!record?.slug) return;
      const first = seen.get(record.slug);
      if (first !== undefined) {
        warnings.push(`${key}[${index}].slug "${record.slug}" repeats ${key}[${first}]. Only the first will be reachable.`);
      } else {
        seen.set(record.slug, index);
      }
    });
  }

  return { ok: true, data, warnings };
}

/** Human-readable block, used by the importer panel and the CLI check. */
export function describeIssues(issues: ValidationIssue[]): string {
  return issues
    .map((issue) => `${issue.path}\n  ${issue.message}${issue.received ? `\n  Found: ${issue.received}` : ''}`)
    .join('\n\n');
}
