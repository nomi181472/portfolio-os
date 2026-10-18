/**
 * Output guard for the local model's markdown. The prompt tells the model to link only to paths that appear in FACTS,
 * but a 360M model can still slip. This removes any markdown link whose target is not in the prompt (keeps the label text).
 * Usage (in the conversational engine, after the model returns `text`):
 *   const safe = stripUnknownLinks(text, allowedLinksFromInstruction(instruction));
 */
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export function allowedLinksFromInstruction(instruction: string): Set<string> {
  const allowed = new Set<string>();
  for (const m of instruction.matchAll(/(?:Link: |\()(\/[A-Za-z0-9_\-/.]+|https?:\/\/[^\s),;]+)/g)) allowed.add(m[1]!.replace(/[.,;]+$/, ''));
  for (const m of instruction.matchAll(/https?:\/\/[^\s),;|]+/g)) allowed.add(m[0].replace(/[.,;]+$/, ''));
  for (const m of instruction.matchAll(/(?:Email: )([^\s|]+?)(?:\.\s|\s|\|)/g)) allowed.add(`mailto:${m[1]}`);
  return allowed;
}

export function stripUnknownLinks(markdown: string, allowed: ReadonlySet<string>): string {
  return markdown.replace(LINK_RE, (full, label: string, url: string) => (allowed.has(url) ? full : label));
}
