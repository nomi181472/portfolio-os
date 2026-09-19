/**
 * lib/stable-json.ts
 *
 * Deterministic serialisation (§91). Two exports of semantically identical
 * content must produce byte-identical files, otherwise every save creates a
 * noisy git diff and reviewing a content change becomes impossible.
 *
 * Object keys are sorted; array order is author-meaningful and is preserved.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function sortValue(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<{ [key: string]: Json }>((acc, key) => {
        const inner = (value as { [key: string]: Json })[key];
        if (inner !== undefined) acc[key] = sortValue(inner);
        return acc;
      }, {});
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortValue(value as Json), null, 2)}\n`;
}
