import { isCached } from '@/lib/agent/models/brain';
import { modelForRole } from '@/lib/agent/registry';

export async function checkAllModelCachesHelper(): Promise<Record<'embedding' | 'conversation' | 'fluent' | 'none', boolean>> {
  const embeddingUrl = modelForRole('embedding').artifact.url;
  const conversationUrl = modelForRole('conversation').artifact.url;
  const fluentUrl = modelForRole('fluent').artifact.url;

  const embeddingCached = await isCached(embeddingUrl);
  const conversationCached = await isCached(conversationUrl);
  const fluentCached = await isCached(fluentUrl);

  return {
    embedding: embeddingCached,
    conversation: conversationCached,
    fluent: fluentCached,
    none: true,
  };
}
