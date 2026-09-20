/**
 * app/api/analytics/collect/route.ts
 *
 * Ingestion endpoint for first-party client analytics events (§41, §46, §47).
 * Validates, normalizes into bounded dimensions, and immediately pushes to
 * the SSR singleton. Never throws; returns 204 No Content.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { WireEventSchema, normalizeEvent } from '@/lib/analytics/events';
import { getAnalyticsManager } from '@/lib/analytics/singleton';
import { countryFromHeaders } from '@/lib/analytics/geo';
import { parseUserAgent } from '@/lib/analytics/registry';
import { deploymentId } from '@/lib/analytics/deployment';

const PayloadSchema = z.union([
  WireEventSchema.transform((e) => [e]),
  z.array(WireEventSchema).min(1).max(30),
]);

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return new NextResponse(null, { status: 400, headers: CORS_HEADERS });
    }

    const parsed = PayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new NextResponse(null, { status: 400, headers: CORS_HEADERS });
    }

    const headers = request.headers;
    const ua = headers.get('user-agent') ?? '';
    const { browser, os, device } = parseUserAgent(ua);
    const country = countryFromHeaders(headers);
    const host = headers.get('host') ?? undefined;

    const manager = getAnalyticsManager();
    const currentDep = deploymentId();

    for (const wire of parsed.data) {
      const normalized = normalizeEvent(wire, {
        deploymentId: wire.d || currentDep,
        country,
        browser,
        os,
        device,
        sameOriginHost: host,
      });
      manager.track(normalized);
    }

    return new NextResponse(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  } catch {
    // Analytics is non-critical: never fail the caller (§47)
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
}
