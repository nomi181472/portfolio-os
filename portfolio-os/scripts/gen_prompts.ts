/** Generates the EXACT system prompts the site would send, using the site's own code (buildKnowledge -> retrieve -> buildInstruction).
 *  usage: tsx scripts/gen_prompts.ts <portfolio.json> <questions.json> <out.json> [dump-knowledge.json] */
import { readFileSync, writeFileSync } from 'node:fs';
import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge } from '../lib/agent/knowledge';
import { buildConversationalEngine } from '../lib/agent/engine';
import { buildInstruction } from '../lib/agent/models/conversation';

const [portfolioPath, questionsPath, outPath, dumpPath] = process.argv.slice(2);
if (!portfolioPath || !questionsPath || !outPath) {
  console.error('usage: tsx scripts/gen_prompts.ts <portfolio.json> <questions.json> <out.json> [dump-knowledge.json]');
  process.exit(1);
}
const raw = JSON.parse(readFileSync(portfolioPath, 'utf8'));
const parsed = validatePortfolio(raw);
if (!parsed.ok) { console.error('portfolio does not validate', JSON.stringify((parsed as any).errors ?? parsed).slice(0, 800)); process.exit(1); }
const NOW = new Date('2026-10-04T00:00:00Z');
const portfolio = parsed.data;
const graph = buildGraph(portfolio);
const knowledge = buildKnowledge(portfolio, graph, { now: NOW });

if (dumpPath) {
  writeFileSync(dumpPath, JSON.stringify({
    profile: knowledge.profile, availability: knowledge.availability, experienceSpan: knowledge.experienceSpan,
    records: knowledge.records.map((r: any) => ({ key: r.key, kind: r.kind, id: r.id, name: r.name, href: r.href, summary: r.summary,
      technologies: r.technologies ?? [], organisation: r.organisation, status: r.status, depth: r.depth, period: r.period,
      evidence: (r.evidence ?? []).map((e: any) => ({ name: e.name, href: e.href })) })),
  }, null, 1));
}

type Q = { id: string; question: string; history?: { question: string; answer: string }[] };
const questions: Q[] = JSON.parse(readFileSync(questionsPath, 'utf8'));
const out: any[] = [];
(async () => {
  for (const q of questions) {
    let captured: any = null;
    const engine = buildConversationalEngine({ portfolio, now: NOW });
    for (const h of q.history ?? []) {   // replay earlier turns so the engine's own memory is identical to production
      await engine.answer(h.question, { conversation: { select: async () => ({ keys: [], text: h.answer }) } as any });
    }
    await engine.answer(q.question, {
      conversation: { select: async (question: string, retrieved: any[], history: any[], facts: any) => {
        captured = { retrieved, history: history.map((x: any) => ({ question: x.question, answer: x.answer })), facts };
        return { keys: retrieved.slice(0, 3).map((r: any) => r.key), text: 'x' };
      } } as any,
    });
    const instruction = buildInstruction({ records: captured.retrieved, ...captured.facts });
    out.push({ id: q.id, question: q.question, instruction, retrieved_keys: captured.retrieved.map((r: any) => r.key),
               history: captured.history.map((t: any) => ({ question: t.question, answer: t.answer })), has_match: Boolean(captured.facts.matchResult),
               records: captured.retrieved, match: captured.facts.matchResult ?? null, facts: captured.facts });
  }
  writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log(`wrote ${out.length} prompts`);
})();
