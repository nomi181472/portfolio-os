import { isCached } from '@/lib/agent/models/brain';
import { modelForRole } from '@/lib/agent/registry';

export async function checkAllModelCachesHelper(): Promise<Record<'embedding' | 'conversation' | 'fluent' | 'smollm' | 'none', boolean>> {
  const embeddingUrl = modelForRole('embedding').artifact.url;
  const conversationUrl = modelForRole('conversation').artifact.url;
  const smollmUrl = modelForRole('smollm').artifact.url;
  const fluentUrl = modelForRole('fluent').artifact.url;

  const embeddingCached = await isCached(embeddingUrl);
  const conversationCached = await isCached(conversationUrl);
  const smollmCached = await isCached(smollmUrl);
  const fluentCached = await isCached(fluentUrl);

  return {
    embedding: embeddingCached,
    conversation: conversationCached,
    smollm: smollmCached,
    fluent: fluentCached,
    none: true,
  };
}
