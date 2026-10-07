/**
 * lib/agent/engine.ts
 *
 * The zero-LLM answer path, end to end.
 *
 * This file serves as the main entry point and facade for the modularized engine components in `./engine/`:
 * - `./engine/types.ts`: Core data structures (Engine, AgentAnswer, CardPlan, ConversationLayer, ActionPlan)
 * - `./engine/planning.ts`: Action planning (planAction, normaliseHref)
 * - `./engine/composer.ts`: Prose generation and wording helpers (composeAnswer, composeReadingsAnswer, plural, etc.)
 * - `./engine/specialAnswers.ts`: Specialized responses (premise, availability, relevance, orientation, noTerms)
 * - `./engine/engineBuilder.ts`: Assembly and execution pipeline (buildEngine, buildEngineFromKnowledge)
 */

export * from './engine/index';
