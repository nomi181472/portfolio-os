/**
 * lib/transfer.ts
 *
 * Import and export (§57, §58, §90). There is exactly one representation of
 * content: what you export is what the app reads. Round-tripping a file must
 * not lose a single field, so export serialises the validated document itself
 * rather than a view-model derived from it.
 */
import { SCHEMA_VERSION } from '@/lib/schema';
import { stableStringify } from '@/lib/stable-json';
import { validatePortfolio, describeIssues, type ValidationIssue } from '@/lib/validate';
import type { Portfolio } from '@/types/portfolio';

export type ExportResult =
  | { ok: true; json: string; filename: string }
  | { ok: false; issues: ValidationIssue[]; report: string };

export function exportPortfolio(draft: unknown, filename = 'portfolio.json'): ExportResult {
  const result = validatePortfolio(draft);
  if (!result.ok) return { ok: false, issues: result.issues, report: describeIssues(result.issues) };
  const normalised: Portfolio = { ...result.data, schemaVersion: SCHEMA_VERSION };
  return { ok: true, json: stableStringify(normalised), filename };
}

export type ImportResult =
  | { ok: true; data: Portfolio; warnings: string[] }
  | { ok: false; issues: ValidationIssue[]; report: string };

export function importPortfolio(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not be parsed';
    return {
      ok: false,
      issues: [{ path: '(file)', message: `This is not valid JSON. ${message}` }],
      report: `This is not valid JSON.\n  ${message}`,
    };
  }
  const result = validatePortfolio(parsed);
  if (!result.ok) return { ok: false, issues: result.issues, report: describeIssues(result.issues) };
  return { ok: true, data: result.data, warnings: result.warnings };
}

/** Browser-only. Kept here so the editor never builds a Blob by hand. */
export function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
