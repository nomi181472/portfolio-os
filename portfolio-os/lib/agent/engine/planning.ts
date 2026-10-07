/**
 * lib/agent/engine/planning.ts
 *
 * Action planning and URL normalization for cards and navigation.
 * Pure and DOM-free.
 */

import type { ResolvedAction } from '../navigation';
import type { ActionPlan } from './types';

/** Route comparison ignores query and hash, so `/x?y=1` and `/x` are the same place. */
export function normaliseHref(href: string): string {
  return href.split('#')[0]?.split('?')[0]?.replace(/\/$/, '') ?? href;
}

/**
 * Decide what to do with a card's action, without doing it.
 *
 * Pure, so the decision is testable without a browser and cannot reach the DOM.
 * `here` is the route the reader is on, compared after stripping the query and hash so
 * `/products/verseye#results` is recognised as being on `/products/verseye`.
 */
export function planAction(
  action: ResolvedAction,
  context: { here: string; entityHref?: string | null },
): ActionPlan {
  if (!action.ok || action.href === null) {
    return { kind: 'none', reason: action.ok ? 'no destination' : action.reason.code };
  }

  const here = normaliseHref(context.here);
  const target = normaliseHref(action.href);

  // Already on the destination. Navigating would reload the page the reader is reading
  // and land them back where they started, so the useful thing is the section, not the
  // route.
  if (here === target) {
    return {
      kind: 'anchor',
      href: `${action.href}#record`,
      label: action.label,
      note: 'You are already on this page — this points at the record itself.',
    };
  }

  // On a *different* record's page, and the action asked to compare. Offer the other
  // record rather than navigating, so the reader keeps what they were reading.
  if (action.kind === 'compare' && context.entityHref) {
    const from = normaliseHref(context.entityHref);
    if (from !== target) {
      return {
        kind: 'offer',
        hrefs: [{ href: from, label: 'Back to this record' }],
        note: 'Opening the other record will replace this page.',
      };
    }
  }

  return { kind: 'anchor', href: action.href, label: action.label, note: '' };
}
