/**
 * lib/headings.ts
 *
 * Heading extraction runs on the server so the contents list is present in the
 * first paint rather than appearing after hydration. Parsing the markdown
 * source rather than the rendered DOM is also what makes it work at all in a
 * statically generated page.
 */

export interface Heading { id: string; text: string; level: number }

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) { inFence = !inFence; continue; }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.*)$/.exec(line);
    if (!match) continue;
    const text = match[2]!.replace(/[#*`]/g, '').trim();
    headings.push({ id: slugify(text), text, level: match[1]!.length });
  }
  return headings;
}
