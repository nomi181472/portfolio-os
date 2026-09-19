/**
 * lib/source.ts
 *
 * Loading strategy (§45, §46, §87). Runs on the server so that content is in
 * the HTML for crawlers and for people on slow connections.
 *
 *   configured source -> fetch -> validate -> fall back to bundled JSON
 *
 * A broken or hostile remote file degrades to the local copy with a visible
 * but quiet source notice. It never produces an error screen.
 */
import 'server-only';

import localPortfolio from '@/content/portfolio.json';
import { portfolioConfig } from '@/config/portfolio.config';
import { buildGraph, type PortfolioGraph } from '@/lib/graph';
import { validatePortfolio, describeIssues } from '@/lib/validate';
import type { DataSourceState, PortfolioBundle } from '@/types/portfolio';

const REVALIDATE = Number(process.env.PORTFOLIO_REVALIDATE ?? 3600);

function loadLocal(source: DataSourceState): PortfolioBundle {
  const result = validatePortfolio(localPortfolio);
  if (!result.ok) {
    // The bundled file is ours, so this is a build-time bug, not a user error.
    throw new Error(`content/portfolio.json is invalid:\n\n${describeIssues(result.issues)}`);
  }
  return { data: result.data, source, warnings: result.warnings };
}

async function loadRemote(url: string): Promise<PortfolioBundle> {
  try {
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE, tags: ['portfolio'] },
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      return loadLocal({ status: 'fallback', url, reason: `Source responded ${response.status}` });
    }
    const json = (await response.json()) as unknown;
    const result = validatePortfolio(json);
    if (!result.ok) {
      return loadLocal({
        status: 'fallback',
        url,
        reason: `Source failed validation: ${result.issues[0]?.path ?? 'unknown field'} — ${result.issues[0]?.message ?? ''}`,
      });
    }
    return {
      data: result.data,
      source: { status: 'remote', url, fetchedAt: new Date().toISOString() },
      warnings: result.warnings,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Network error';
    return loadLocal({ status: 'fallback', url, reason });
  }
}

let cached: Promise<PortfolioBundle> | undefined;

export function getPortfolio(): Promise<PortfolioBundle> {
  if (!cached) {
    const source = portfolioConfig.dataSource;
    const configured = process.env.NEXT_PUBLIC_PORTFOLIO_URL ?? (source.type === 'remote' ? source.url : undefined);
    cached = configured
      ? loadRemote(configured)
      : Promise.resolve(loadLocal({ status: 'local' }));
  }
  return cached;
}

export async function getGraph(): Promise<{ bundle: PortfolioBundle; graph: PortfolioGraph }> {
  const bundle = await getPortfolio();
  const graph = buildGraph(bundle.data);
  return { bundle, graph };
}
