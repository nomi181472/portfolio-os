/**
 * lib/analytics/deployment.ts
 *
 * Deployment identity (§10). Inlined at build time by next.config.mjs:
 *
 *   NEXT_PUBLIC_DEPLOYMENT_ID        explicit override (v12, release-…, sha…)
 *   NEXT_PUBLIC_DEPLOYMENT_TIMESTAMP explicit build time override
 *
 * with git short SHA / build time as automatic fallbacks. Because these are
 * NEXT_PUBLIC_*, every rendered page — and therefore every analytics event the
 * client sends — carries the deployment it was built against.
 */
let resolvedId: string | undefined;
let resolvedTimestamp: number | undefined;

export function deploymentId(): string {
  if (resolvedId === undefined) {
    resolvedId = process.env.NEXT_PUBLIC_DEPLOYMENT_ID?.trim() || 'dev';
  }
  return resolvedId;
}

export function deploymentTimestamp(): number {
  if (resolvedTimestamp === undefined) {
    const parsed = Number(process.env.NEXT_PUBLIC_DEPLOYMENT_TIMESTAMP ?? 0);
    resolvedTimestamp = Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
  }
  return resolvedTimestamp;
}

export interface DeploymentInfo {
  id: string;
  timestamp: number;
  version: string;
}

export function currentDeployment(): DeploymentInfo {
  return {
    id: deploymentId(),
    timestamp: deploymentTimestamp(),
    version: deploymentId(),
  };
}