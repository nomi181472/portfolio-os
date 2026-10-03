/**
 * lib/agent/text.ts
 *
 * Text normalisation shared by the alias table and the question normaliser.
 *
 * These two have to agree. The alias table is keyed on `normaliseTerm`-shaped
 * strings, and `normaliseQuestion` feeds it raw user text: if the two disagreed
 * about what a term looks like, a question would resolve terms the table never
 * received in that form, and the symptom would be an alias that works in a unit
 * test and fails in a real conversation. One implementation, so they cannot.
 */

/**
 * Lowercase, and keep the characters that are part of a technology's name.
 *
 * `.NET`, `C++`, `C#` and `Node.js` are one term each. Stripping `.` and `+` and
 * `#` as punctuation turns them into `net`, `c`, `c` and `nodejs` — the first
 * three being wrong in ways that produce confident nonsense, since `c` matches
 * by containment against half the corpus.
 */
export function normaliseTerm(raw: string): string {
  return raw
    .toLowerCase()
    // Curly quotes, so a term copied out of a Word document still resolves.
    .replace(/[‘’]/g, "'")
    // Everything else becomes a space. Kept deliberately narrow: a-z, 0-9, and
    // the four characters that appear inside real technology names.
    .replace(/[^a-z0-9+.#\-/_ ]/g, ' ')
    // Separators become spaces rather than disappearing, so `k8-s` and `k 8 s`
    // land in the same place.
    .replace(/[-/_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A term with its separators removed, for abbreviation matching.
 *
 * "k8s" and "k 8 s" and "k-8-s" all become `k8s`, which is how an abbreviation
 * reaches a full name without a hand-written rule per abbreviation.
 */
export function squashed(raw: string): string {
  return normaliseTerm(raw).replace(/[\s.]/g, '');
}
