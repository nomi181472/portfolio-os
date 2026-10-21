/**
 * Output guard for the local model's markdown links.
 *
 * Goal: visitors can click through to REAL portfolio pages, and the model can never send them to a page that does not exist.
 * A link is therefore judged against the site's real routes (every knowledge record's href + navigation targets), not only against
 * the 8 records retrieved for the current question. Rules, per markdown link `[label](url)`:
 *   1. url present in the prompt / profile links (e.g. LinkedIn, mailto)   -> kept
 *   2. internal path that is a real route (trailing slash / #anchor / ?query ignored) -> kept
 *   3. internal path that is NOT a real route but the label names a real record      -> repaired to that record's href
 *   4. anything else (unknown route, unknown external site)                         -> reduced to its label text
 */
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export interface LinkIndex {
  readonly routes: ReadonlySet<string>;
  readonly byName: ReadonlyMap<string, string>;
}

const normPath = (p: string): string => {
  const x = (p.split('#')[0] ?? '').split('?')[0] ?? '';
  return x.length > 1 ? x.replace(/\/+$/, '') : x;
};
const nameKey = (s: string): string => s.toLowerCase().replace(/\s*\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function buildLinkIndex(
  records: ReadonlyArray<{ readonly name: string; readonly href?: string | undefined }>,
  navigation: ReadonlyArray<{ readonly href: string }> = [],
): LinkIndex {
  const routes = new Set<string>(['/']);
  const byName = new Map<string, string>();
  const ambiguous = new Set<string>();
  const addName = (raw: string, href: string): void => {
    const k = nameKey(raw);
    if (!k) return;
    if (byName.has(k) && byName.get(k) !== href) ambiguous.add(k);
    else byName.set(k, href);
  };
  for (const t of navigation) routes.add(normPath(t.href));
  for (const r of records) {
    if (!r.href) continue;
    routes.add(normPath(r.href));
    addName(r.name, r.href);
    addName(r.name.split(' — ')[0] ?? r.name, r.href);
  }
  for (const k of ambiguous) byName.delete(k);   // a label that names two different pages is not safe to repair
  return { routes, byName };
}

export function repairLinks(markdown: string, index: LinkIndex, allowed: ReadonlySet<string> = new Set()): string {
  return markdown.replace(LINK_RE, (full: string, label: string, url: string) => {
    if (allowed.has(url)) return full;
    if (url.startsWith('/')) {
      if (index.routes.has(normPath(url))) return full;
      const fixed = index.byName.get(nameKey(label));
      return fixed ? `[${label}](${fixed})` : label;
    }
    return label;
  });
}

/** URLs / paths / mailto targets that appear in a prompt (contact links, `Link:` fields, linked receipts). */
export function allowedLinksFromInstruction(instruction: string): Set<string> {
  const allowed = new Set<string>();
  for (const m of instruction.matchAll(/(?:Link: |\()(\/[A-Za-z0-9_\-/.]+|https?:\/\/[^\s),;]+)/g)) allowed.add(m[1]!.replace(/[.,;]+$/, ''));
  for (const m of instruction.matchAll(/https?:\/\/[^\s),;|]+/g)) allowed.add(m[0].replace(/[.,;]+$/, ''));
  for (const m of instruction.matchAll(/(?:Email: )([^\s|]+?)(?:\.\s|\s|\|)/g)) allowed.add(`mailto:${m[1]}`);
  return allowed;
}

/** Strict variant kept for callers that only want "present in this prompt". */
export function stripUnknownLinks(markdown: string, allowed: ReadonlySet<string>): string {
  return markdown.replace(LINK_RE, (full: string, label: string, url: string) => (allowed.has(url) ? full : label));
}
