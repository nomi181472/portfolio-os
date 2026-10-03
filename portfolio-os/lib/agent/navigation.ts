/**
 * lib/agent/navigation.ts
 *
 * The set of places the agent is allowed to send the reader, and the rules for
 * getting there.
 *
 * The whole point of this file is that the agent cannot emit a URL. It returns an
 * `action` carrying a target **id**, and the id is resolved against a registry
 * built from `CATEGORY_LIST` and `lib/graph.ts`'s `hrefFor` — the same sources the
 * sidebar, the sitemap and the route table are generated from. A hallucinated
 * path is therefore not a thing the agent can express, rather than a thing the
 * agent is asked not to do.
 *
 * Validation is deliberately strict and deliberately *closed by default*: an
 * unknown id produces a rejection with a reason, never a best-effort guess and
 * never a fallback to a search page. A wrong link is worse than no link.
 */

import { CATEGORY_LIST } from '@/lib/categories';
import { hrefFor } from '@/lib/graph';
import type { EntityKind, Portfolio } from '@/types/portfolio';
import type { NavigationTarget } from './types';

export interface NavigationRegistry {
  /** Every target, in presentation order. */
  targets: NavigationTarget[];
  /** id -> target. Also holds entity targets, keyed `kind:id`. */
  byId: Map<string, NavigationTarget>;
}

/**
 * Static pages that are not category hubs.
 *
 * Kept as data, not derived, because these are hand-built pages: there is no
 * collection in `portfolio.json` they come from. Each one is still checked
 * against the route tree at build time by `assertRoutesExist`, so adding a page
 * here without creating the route is a test failure rather than a 404.
 */
const STATIC_PAGES: readonly { id: string; label: string; href: string; conditional?: (p: Portfolio) => boolean }[] = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'explore', label: 'Explore', href: '/explore' },
  { id: 'startup', label: 'Startup', href: '/startup', conditional: (p) => Boolean(p.startup) },
  { id: 'future', label: 'Trajectory', href: '/future' },
  { id: 'colophon', label: 'Colophon', href: '/colophon' },
];

/**
 * Builds the registry.
 *
 * Category hubs come from `CATEGORY_LIST` rather than from a hand-typed list, so
 * adding a collection to `lib/categories.ts` automatically gives the agent a hub
 * to send readers to. `app/[category]/page.tsx` keys its param by `kind`, which
 * is why the href is `/${category.kind}` and not the label.
 *
 * Entity targets are *not* enumerated. There are 93 of them and the set changes
 * whenever content is edited; a target for a specific entity is resolved through
 * `resolveAction` against the knowledge registry instead, which is already
 * derived from the same graph. Enumerating them here would create a second list
 * that can disagree with the first.
 */
export function buildNavigationRegistry(portfolio: Portfolio): NavigationRegistry {
  const targets: NavigationTarget[] = [];

  for (const page of STATIC_PAGES) {
    if (page.conditional && !page.conditional(portfolio)) continue;
    targets.push({ id: page.id, label: page.label, href: page.href, kind: 'page' });
  }

  for (const category of CATEGORY_LIST) {
    targets.push({
      id: category.kind,
      label: category.label,
      href: `/${category.kind}`,
      kind: 'category',
      entityKind: category.kind,
    });
  }

  return {
    targets,
    byId: new Map(targets.map((target) => [target.id, target])),
  };
}

/**
 * Rebuild the registry from targets that have been through JSON.
 *
 * The client gets `registry.targets` as an array and needs `byId` back. Doing it
 * here rather than inlining `new Map(...)` at the call site keeps one
 * constructor, so a registry on the client and a registry on the server cannot
 * disagree about what is navigable.
 */
export function navigationRegistryFromTargets(targets: readonly NavigationTarget[]): NavigationRegistry {
  return {
    targets: [...targets],
    byId: new Map(targets.map((target) => [target.id, target])),
  };
}

/* ------------------------------------------------------------- validation */

/**
 * The kinds an action can be.
 *
 * There is no `highlight`. It was in this union for most of the build, resolved
 * successfully, and then nothing ever rendered it — `planAction` returned the same plain
 * anchor it returns for `navigate`, so a highlight proposal was a no-op that cost the
 * model part of its output budget to emit.
 *
 * It could not be implemented honestly rather than merely unimplemented. The promise
 * was "point at the part of a record that answers the question", and a record's page is
 * rendered from `portfolio.json` with no per-passage addressing — there is no anchor to
 * point at. Inventing one would mean generating ids into content pages, which is a
 * content-model change, not an agent change. Removing the kind is the honest option:
 * an unimplemented member of a union is worse than no member, because it advertises a
 * capability a reader cannot find.
 *
 * `none` stays, and is the useful shape of the same idea: the model can decline to
 * propose anything, which is the common and correct outcome.
 */
export type ActionKind = 'navigate' | 'compare' | 'none';

export interface ActionRequest {
  kind: ActionKind;
  /**
   * The target the action refers to: a registry id or an entity key. Free text is
   * accepted here only so that a resolution failure can explain *what* it could not
   * resolve, not so that it can be passed through to the UI unchecked.
   */
  targetId: string;
  label?: string;
}

export type ActionRejection =
  | { code: 'unknown-target'; targetId: string }
  | { code: 'empty-target' }
  | { code: 'malformed-target'; targetId: string }
  | { code: 'not-navigable'; targetId: string; reason: string };

export type ResolvedAction =
  | { ok: true; kind: ActionKind; href: string | null; label: string; targetId: string }
  | { ok: false; kind: ActionKind; reason: ActionRejection };

const ENTITY_KEY = /^[a-z]+:[a-z0-9][a-z0-9-]*$/;

/**
 * Turns a proposed action into one that is safe to render, or explains why not.
 *
 * Three separate checks, in order, because they fail for different reasons and
 * the caller should be able to say which one happened:
 *
 *  1. **Shape.** An id that is not a registry id and not `kind:id` is malformed.
 *     Caught before anything is looked up so a junk string cannot be used to
 *     probe the registry.
 *  2. **Entity existence.** A well-formed entity key that is not in the knowledge
 *     set is unknown. This is the check that stops a plausible-sounding id like
 *     `skills:sk-kubernetes` from becoming a link to nothing.
 *  3. **Navigability.** Not everything that exists can be linked. A record whose
 *     href is a real route is fine; a record with no page of its own is reported
 *     as such rather than linked to a category it does not belong to.
 */
export function resolveAction(
  request: ActionRequest,
  registry: NavigationRegistry,
  hasEntity: (key: string) => boolean,
  hrefForKey: (key: string) => string | undefined,
): ResolvedAction {
  const targetId = request.targetId.trim();

  if (targetId.length === 0) {
    return { ok: false, kind: request.kind, reason: { code: 'empty-target' } };
  }

  // 1. A registry id wins outright. These are known-good by construction, so
  //    they skip the entity checks below.
  const known = registry.byId.get(targetId);
  if (known) {
    return {
      ok: true,
      kind: request.kind,
      href: request.kind === 'navigate' ? known.href : null,
      label: request.label ?? known.label,
      targetId,
    };
  }

  // 2. An entity key, which must name a record that actually exists.
  if (!ENTITY_KEY.test(targetId)) {
    return { ok: false, kind: request.kind, reason: { code: 'malformed-target', targetId } };
  }

  if (!hasEntity(targetId)) {
    return { ok: false, kind: request.kind, reason: { code: 'unknown-target', targetId } };
  }

  const href = hrefForKey(targetId);

  // 3. Exists, but has nowhere to go. Nothing may pass this: an action with no
  //    destination has nothing to do, and `none` is how a model declines.
  if (!href) {
    return {
      ok: false,
      kind: request.kind,
      reason: {
        code: 'not-navigable',
        targetId,
        reason: 'this record has no page of its own',
      },
    };
  }

  return { ok: true, kind: request.kind, href, label: request.label ?? targetId, targetId };
}

/* ------------------------------------------------ model proposals */

/**
 * An action a model asked for, before anything has checked it.
 *
 * `kind` is a `string` rather than an `ActionKind` on purpose. The whole point is that
 * a model can emit a kind that does not exist, and typing the field as one of the four
 * valid ones would make that unrepresentable in a way the runtime does not enforce —
 * the sort of gap where the type says it is safe and the value disagrees.
 */
export interface ProposedAction {
  kind: string;
  targetId: string;
  label?: string;
}

/** A proposal that resolved. `href` came from the registry, never from the model. */
export interface CheckedAction {
  kind: ActionKind;
  href: string | null;
  label: string;
  targetId: string;
}

const ACTION_KINDS: readonly string[] = ['navigate', 'compare', 'none'];

/**
 * How many actions one turn may propose.
 *
 * Two, because a card has room for a primary and a secondary control and nothing else.
 * A model that wanted five was not describing one reader's next step.
 */
export const MAX_ACTIONS = 2;

/**
 * Resolve proposed actions against the navigation registry.
 *
 * Everything a model proposes about navigation is untrusted input, because that is
 * exactly what it is: text from a model, which will occasionally emit a perfectly
 * plausible target for a page that does not exist. Every proposal goes through the
 * same `resolveAction` the deterministic path uses, and anything unresolved is dropped
 * rather than rendered.
 *
 * `href` is never taken from the model — only ever from the registry or from
 * `hrefForKey` — so a generated string cannot become a link target.
 *
 * Lives here rather than in `models/conversation.ts` because the caller that turns an
 * action into a rendered link is the engine, and the engine must stay free of the
 * model modules. This is the boundary: navigation owns it, so the check cannot be
 * skipped by a caller that never opened the model file.
 */
export function checkActions(
  proposed: readonly ProposedAction[],
  registry: NavigationRegistry,
  hasEntity: (key: string) => boolean,
  hrefForKey: (key: string) => string | undefined,
): CheckedAction[] {
  const checked: CheckedAction[] = [];

  for (const action of proposed) {
    // Capped before the resolve, not after. A third proposal is not a control the
    // panel has room for, and spending a registry lookup on it to discover that later
    // is work whose cost only shows up on a slow device.
    if (checked.length >= MAX_ACTIONS) break;

    // An unrecognised kind is not coerced to a default. `none` would render a
    // button that does nothing, which reads as a bug to the person pressing it.
    if (!ACTION_KINDS.includes(action.kind)) continue;

    // Two proposals for one target collapse to the first. A model that asked for both
    // a navigate and a compare on the same record has not chosen between them, and
    // rendering both would put two controls for one card in front of the reader.
    if (checked.some((entry) => entry.targetId === action.targetId.trim())) continue;

    const resolved = resolveAction(
      {
        kind: action.kind as ActionKind,
        targetId: action.targetId,
        ...(action.label ? { label: action.label } : {}),
      },
      registry,
      hasEntity,
      hrefForKey,
    );

    if (resolved.ok) {
      checked.push({
        kind: resolved.kind,
        href: resolved.href,
        label: resolved.label,
        targetId: resolved.targetId,
      });
    }
  }

  return checked;
}

/** Exported for the route-tree test. */
export const STATIC_PAGE_HREFS = STATIC_PAGES.map((page) => page.href);
