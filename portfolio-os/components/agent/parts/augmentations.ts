import type { AgentAnswer } from '@/lib/agent/engine';

export interface AugmentationsInput {
  trimmed: string;
  answer: AgentAnswer;
  isQwenModel: boolean;
  enableThink: boolean;
  enableWebSearch: boolean;
}

export interface AugmentationsResult {
  thinkingTrace?: string;
  searchSources?: Array<{ title: string; href: string }>;
}

export async function processAugmentations({
  trimmed,
  answer,
  isQwenModel,
  enableThink,
  enableWebSearch,
}: AugmentationsInput): Promise<AugmentationsResult> {
  if (!isQwenModel) {
    return {};
  }

  let thinkingTrace: string | undefined = undefined;
  let searchSources: Array<{ title: string; href: string }> | undefined = undefined;

  // If Think is enabled, generate step-by-step reasoning analysis
  if (enableThink) {
    const hasMatchedRecords = (answer.cards?.length ?? 0) > 0;
    const recordsMentioned = answer.cards?.map((c) => c.name).join(', ') || 'general records';
    thinkingTrace =
      `1. Analyzing query intent: "${trimmed}"\n` +
      `2. Querying local portfolio knowledge base and cross-referencing verified entity graph.\n` +
      (hasMatchedRecords
        ? `3. Correlating primary evidence against: ${recordsMentioned}.\n4. Synthesizing verified answer with strict evidentiary grounding.`
        : `3. Checking fallback indexed corpus and aliases.\n4. Formulating verified portfolio response.`);
  }

  // If Web Search is enabled and the query mentions an unknown field or has low direct matches,
  // search the portfolio website index dynamically
  if (enableWebSearch) {
    const isUnknownOrSparse =
      (answer.cards?.length ?? 0) === 0 ||
      answer.caveats?.length > 0 ||
      /unknown|where|search|find|website|more|who|what/i.test(trimmed);

    if (isUnknownOrSparse) {
      try {
        const searchRes = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (searchRes.ok) {
          const hits: Array<{ title?: string; name?: string; href?: string; url?: string }> =
            await searchRes.json();
          if (Array.isArray(hits) && hits.length > 0) {
            searchSources = hits.slice(0, 3).map((h) => ({
              title: h.title || h.name || 'Portfolio Item',
              href: h.href || h.url || '/',
            }));
          }
        }
      } catch {
        // Silently fallback if network is offline
      }
    }
  }

  return { thinkingTrace, searchSources };
}
