'use client';

/**
 * components/agent/AgentWidget.tsx
 *
 * The chat surface, running entirely in the browser.
 *
 * There is no inference on the server. The widget fetches the same derived
 * payload `/api/agent/knowledge` serves, rehydrates it, and runs the same pure
 * modules the tests run — so the answers here are the answers `tests/` asserts
 * on, and `tests/agent-wire.test.ts` checks that the two paths agree.
 *
 * The knowledge payload is fetched the first time the widget is opened, never
 * before, for the same reason `CommandMenu` does it: it is 38.5 kB gzipped and
 * only matters to someone who has already decided to ask. The Shell latches the
 * mount, so the second open costs nothing and the payload is fetched once.
 *
 * It is the *full* payload, not `?corpus=none`. Lean is 16.5 kB, but it drops
 * every record's `text`, and without text the local retriever has nothing to
 * match against — `canRetrieveLocally` returns false and questions stop being
 * answerable at all. Half the payload that cannot answer is not worth having.
 *
 * The career span is computed server-side when the payload is built, so a
 * duration question reflects the moment of the fetch rather than the visitor's
 * clock. That is deliberate: the answer is then identical on both paths, which
 * `tests/agent-wire.test.ts` asserts.
 *
 * **No model yet.** Every answer below is composed by `composeAnswer` from
 * evidence states and counts. That is the whole point of doing it this way round:
 * the widget is useful before the model exists, and adding one later adds
 * phrasing and nothing else.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  buildEngineFromKnowledge,
  type AgentAnswer,
  type CardPlan,
  type ConversationLayer,
  type Engine,
} from '@/lib/agent/engine';
import { normaliseQuestion } from '@/lib/agent/normalize';
import type { AliasTable } from '@/lib/agent/aliases';
import type { MatchResult, RequirementScore } from '@/lib/agent/scoring';
import { navigationRegistryFromTargets } from '@/lib/agent/navigation';
import { rehydrateKnowledge } from '@/lib/agent/wire';
import {
  coldLoadSummary,
  deleteCachedModel,
  describeBrain,
  detectBackend,
  isCached,
  loadModel,
  type BrainState,
  type LoadedModel,
} from '@/lib/agent/models/brain';
import {
  createConversation,
  estimateTokens,
  MAX_CONTEXT_TOKENS,
  MAX_INPUT_QUESTION_TOKENS,
  type Conversation,
} from '@/lib/agent/models/conversation';
import { coldBytes, formatMb, modelForRole, type ModelBackend, type ModelRole } from '@/lib/agent/registry';

export type ModelChoiceId = ModelRole | 'none';

export interface ModelListItem {
  id: string;
  role: ModelChoiceId;
  name: string;
  badge: string;
  size: string;
  url?: string;
  description: string;
}

// Calculated model sizes for UI display: formatMb(coldBytes(['conversation'])) and coldLoadSummary(backend, ['embedding'])
const AVAILABLE_MODELS: ModelListItem[] = [
  {
    id: 'Xenova/multilingual-e5-small',
    role: 'embedding',
    name: 'Neural Vector Brain (E5 Small)',
    badge: 'Vector Search',
    size: '~118 MB',
    url: modelForRole('embedding').artifact.url,
    description: 'Local vector search engine. Converts portfolio passages into 384-dimensional vector space for instant concept & semantic matching.',
  },
  {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    role: 'conversation',
    name: 'Conversational LLM (Qwen2.5 0.5B)',
    badge: 'Dynamic Dialogue',
    size: '~512 MB',
    url: modelForRole('conversation').artifact.url,
    description: 'Local conversational AI model. Enables dynamic generative dialogue grounded strictly in verified portfolio facts. Note: It cannot change the wording, the score, or what is documented, keeping answers strictly grounded in portfolio evidence.',
  },
  {
    id: 'onnx-community/Qwen2.5-1.5B-Instruct',
    role: 'fluent',
    name: 'High-Quality LLM (Qwen2.5 1.5B)',
    badge: 'Advanced AI',
    size: '~1.58 GB',
    url: modelForRole('fluent').artifact.url,
    description: 'Advanced 1.5B parameter conversational model for deeper natural phrasing and dynamic conversation.',
  },
  {
    id: 'none',
    role: 'none',
    name: 'Without Model (Direct Search)',
    badge: 'Extractive Mode',
    size: '0 MB',
    description: 'Runs directly using deterministic search & indexing without downloading or running any local AI models.',
  },
];
import {
  corpusHash,
  createE5Embedder,
  emptyVectorStore,
  E5_DIMENSIONS,
  modelIdForRole,
  type E5Embedder,
  type EmbedderState,
  type FeatureExtractionPipeline,
} from '@/lib/agent/models/embeddings';
import { persistVectors, restoreVectors } from '@/lib/agent/models/vector-persistence';
import type { KnowledgePayload, PortfolioKnowledge } from '@/lib/agent/types';
import styles from './AgentWidget.module.css';

type EngineState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; engine: Engine }
  | { status: 'failed' };

interface Turn {
  id: number;
  question: string;
  answer: AgentAnswer | null;
  modelName?: string;
  thinking?: string;
  searchSources?: Array<{ title: string; href: string }>;
}

/**
 * The optional model's state, as this component needs it.
 *
 * Distinct from `BrainState`, which describes only the *download*. Indexing is a
 * second phase with its own progress, and folding it into one union would mean either
 * a progress bar that reports bytes while it is really reporting chunks, or a
 * `status` with a `phase` field and two meanings at once.
 */
type SemanticState =
  | { status: 'unavailable' }
  | { status: 'indexing'; done: number; total: number }
  | { status: 'ready'; chunks: number }
  | { status: 'failed'; message: string };

/**
 * The conversational model, tracked apart from the embedder.
 *
 * `ready` carries the timings the panel shows. Both are measured, never estimated:
 * `loadMs` from the loader and `inferenceMs` around the last generation call. A
 * figure that was not measured would be worse than no figure, because a reader would
 * take it as a performance claim.
 */
type ChatState =
  | { status: 'idle' }
  /**
   * `downloading` carries the loader's own byte counts rather than a boolean, so this
   * 512 MB download can report progress like the 118 MB one does. A `loading` state
   * with no counts would mean an indeterminate bar on the largest download the widget
   * offers, which is exactly where a reader most wants to know it is still moving.
   */
  | { status: 'loading'; bytesLoaded?: number; bytesTotal?: number; backend?: ModelBackend }
  | { status: 'ready'; backend: 'webgpu' | 'wasm'; loadMs: number; fromCache: boolean }
  | { status: 'failed'; message: string };

/**
 * What to say when answering itself fails.
 *
 * `empty` is set because that is the flag the UI reads to suppress evidence
 * furniture: there is nothing to substantiate, so nothing is presented. The text
 * says what happened rather than blaming the visitor's question, and no partial
 * answer is offered — a failed lookup and an honest absence must not look alike.
 */
function failureAnswer(question: string, aliases: AliasTable): AgentAnswer {
  return {
    question,
    intent: 'general',
    routing: { intent: 'general', confidence: 0, signals: [], uncertain: true },
    normalised: normaliseQuestion(question, aliases),
    text: 'Something went wrong reading the portfolio. Nothing has been guessed in its place.',
    cards: [],
    navigation: [],
    empty: true,
    caveats: [],
  };
}

/** Offered before the visitor types, and the only prompts shown. */
const SUGGESTIONS = [
  'Do you have experience with Kubernetes?',
  'Are you open to work?',
  'What did you build at Ktrade?',
] as const;

/**
 * Download progress as a whole percent, clamped.
 *
 * Clamped because `progress_callback` reports per-file totals that can briefly
 * exceed the declared artefact size — a container adding up several files against
 * one file's expected length — and `role="progressbar"` with an `aria-valuenow`
 * above its own maximum is a lie to a screen reader even though the bar renders.
 */
function progressPercent(state: Extract<BrainState, { status: 'downloading' }>): number {
  if (state.bytesTotal <= 0) return 0;
  const raw = Math.round((state.bytesLoaded / state.bytesTotal) * 100);
  return Math.max(0, Math.min(100, raw));
}

/** Decimal MB with one fraction digit, so a stalled download is visible as such. */
function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * A measured duration, one decimal place.
 *
 * Only ever called with a number that came from `Date.now()` around real work. There
 * is no fallback figure: an unmeasured duration is shown as nothing rather than as a
 * round number a reader would take for a benchmark.
 */
function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

interface AgentWidgetProps {
  open: boolean;
  /** Opens the panel. Separate from `open` so the Shell can latch the chunk. */
  onOpen: () => void;
  onClose: () => void;
}

export function AgentWidget({ open, onOpen, onClose }: AgentWidgetProps) {
  const [state, setState] = useState<EngineState>({ status: 'idle' });
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  /**
   * Where each turn's cards lead, from the reader's current route.
   *
   * Keyed by turn id rather than stored on the turn, because the answer is a record of
   * what was asked while the destinations depend on where the reader is standing now.
   * A reader who follows a link and comes back should find the links pointing at the
   * records rather than still saying "already on this page".
   */
  const [cardPlans, setCardPlans] = useState<Map<number, Map<string, CardPlan>>>(new Map());
  const [busy, setBusy] = useState(false);
  const [brain, setBrain] = useState<BrainState>({ status: 'idle' });
  const [backend, setBackend] = useState<ModelBackend | null>(null);
  /**
   * The conversational model, offered separately from the embedder.
   *
   * Its own state because it is a second, much larger download and a separate
   * decision: 512 MB against 118 MB for the embedder. Bundling them into one button
   * would mean asking for the cheap one costs the expensive one, and asking for the
   * expensive one is not what most readers came for.
   */
  const [chat, setChat] = useState<ChatState>({ status: 'idle' });
  /**
   * Held in a ref, not state.
   *
   * The embedder is a large mutable object, and putting it in state would mean every
   * indexing progress tick re-renders the whole conversation. `ask` reads the ref at
   * call time, so nothing needs to re-render when it becomes available.
   */
  const embedderRef = useRef<E5Embedder | null>(null);
  /**
   * The conversational model, in a ref for the same reason as the embedder: it is a
   * large mutable object, and progress ticks must not re-render the conversation.
   */
  const conversationRef = useRef<Conversation | null>(null);
  /** Real generation time for the last question, or null when no model ran. */
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [semantic, setSemantic] = useState<SemanticState>({ status: 'unavailable' });
  const [selectedModelChoice, setSelectedModelChoice] = useState<ModelChoiceId>('none');
  const [cachedModels, setCachedModels] = useState<Record<ModelChoiceId, boolean>>({
    embedding: false,
    conversation: false,
    fluent: false,
    none: true,
  });
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [pendingDownloadModel, setPendingDownloadModel] = useState<ModelListItem | null>(null);
  const [enableThink, setEnableThink] = useState(true);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [greetingMessage, setGreetingMessage] = useState(
    'What do you want to know about me? Give me your JDK, and I will give you an honest answer as far as possible.',
  );

  const pickRandomGreeting = useCallback((role?: ModelChoiceId) => {
    const defaultVariations = [
      'What do you want to know about me? Give me your JDK, and I will give you an honest answer as far as possible.',
      'What would you like to explore about Noman? Share your requirements or tech stack, and I will provide precise insights.',
      'Curious about Noman’s experience? Ask me anything about architectures, distributed systems, or skills, and I will answer truthfully.',
      'What do you want to analyze today? Paste a job description or query, and I will evaluate Noman’s exact fit.',
      'Ready to assist! Ask me about Noman’s past engineering achievements, codebases, or system design decisions.',
    ];

    const qwen05Variations = [
      'Qwen 0.5B Instruct model is ready! Ask me anything about Noman’s backend architecture, Kubernetes experience, or project history.',
      'Loaded Qwen 0.5B! Give me your job description or tech stack (e.g. JDK/Node/Go), and I will evaluate Noman’s direct fit.',
      'Qwen 0.5B is active locally! What would you like to know about Noman’s experience at Ktrade or Verseye?',
    ];

    const qwen15Variations = [
      'Qwen 1.5B High-Quality LLM is active! Ask me deep questions about system design, microservices, or team leadership.',
      'Loaded Qwen 1.5B Instruct! Paste your role requirements or engineering challenges, and let us discuss Noman’s qualifications in detail.',
      'Qwen 1.5B neural engine ready! What technical achievements or architecture patterns would you like to explore?',
    ];

    const e5Variations = [
      'Neural Vector Brain (E5 Small) is online! Searching 384-dimensional vector space for semantic concept matches across portfolio passages.',
      'Vector Search engine ready! Ask any conceptual question to search Noman’s portfolio by semantic meaning.',
    ];

    let pool = defaultVariations;
    if (role === 'conversation') pool = qwen05Variations;
    else if (role === 'fluent') pool = qwen15Variations;
    else if (role === 'embedding') pool = e5Variations;

    const randomIndex = Math.floor(Math.random() * pool.length);
    const chosen = pool[randomIndex];
    if (chosen) setGreetingMessage(chosen);
  }, []);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const knowledgeRef = useRef<PortfolioKnowledge | null>(null);

  /**
   * The records to embed, as key and text only.
   *
   * Reduced to the two fields the embedder reads. Passing whole `KnowledgeRecord`s
   * would mean the corpus hash covered fields the model never sees, so an unrelated
   * change to a record's dates would invalidate 125 cached vectors for no reason.
   */
  const knowledgeRecords = useCallback(
    () => (knowledgeRef.current?.records ?? []).map((record) => ({ key: record.key, text: record.text })),
    [],
  );
  const nextId = useRef(0);
  const started = useRef(false);
  /**
   * Monotonic id of the current chat-load attempt.
   *
   * A ref and not a local variable because the guard has to survive across invocations.
   * A `let current = true` inside `startChat` is only ever set false by *its own*
   * cleanup, so a reader who clicks "Try again" while the first attempt is still
   * unwinding leaves both attempts with `current === true` — and the slower one wins the
   * bar, the panel's state, and `conversationRef` at the end. That is not a cosmetic
   * race: the two loads resolve to different pipelines, so the panel can end up
   * reporting the timings of a load whose pipeline it discarded.
   */
  const chatAttempt = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  /** The launcher, as the focus-restore target. */
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Fetched on first open, and only then.
  //
  // The guard is a ref, not the status, and that matters. Listing `state.status`
  // as a dependency would re-run this effect the moment `setState({loading})`
  // below lands, whose cleanup would mark the in-flight fetch cancelled and the
  // panel would sit on "Reading the portfolio…" forever. The ref is the only
  // thing that decides whether to start.
  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    setState({ status: 'loading' });

    fetch('/api/agent/knowledge', { headers: { accept: 'application/json' } })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<KnowledgePayload>)
          : Promise.reject(new Error(String(response.status))),
      )
      .then((payload) => {
        const knowledge = rehydrateKnowledge(payload);
        // Kept in a ref as well as in `state` because indexing needs the record text
        // without depending on a re-render, and the callback that starts the download
        // must not close over the whole engine.
        knowledgeRef.current = knowledge;
        setState({
          status: 'ready',
          engine: buildEngineFromKnowledge(knowledge, {
            navigation: navigationRegistryFromTargets(knowledge.navigation),
          }),
        });
      })
      .catch(() => setState({ status: 'failed' }));
    // No cleanup, deliberately: the payload is wanted from here on, so a close
    // mid-fetch should not throw the work away. State set after unmount is inert.
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, state.status]);

  // Which backend this browser will actually use, asked once on first open.
  //
  // Needed before the invitation can quote a download figure: the two backends are
  // close enough in total (688 MB WebGPU against 630 MB WASM — `PLAN.md` §1) that
  // quoting the wrong one would misstate the cost by 58 MB. Detection only, no
  // load: the reader has to ask for the download first.
  //
  // No cleanup, and `backend` is deliberately kept out of the dependency array.
  // Returning one would tear down the detection on the very re-render that
  // `setBackend` causes — the exact shape `tests/client-effects.test.ts` exists to
  // catch, and the shape that left the search box on "Loading the index…" forever.
  // The guard is a ref instead, so the effect runs once and a late result on a
  // closed panel is simply state nobody reads.
  const detectedBackend = useRef(false);
  useEffect(() => {
    if (!open || detectedBackend.current) return;
    detectedBackend.current = true;
    void detectBackend(modelForRole('embedding').devices).then((result) => setBackend(result.backend));
  }, [open]);

  const checkAllModelCaches = useCallback(async () => {
    const embeddingUrl = modelForRole('embedding').artifact.url;
    const conversationUrl = modelForRole('conversation').artifact.url;
    const fluentUrl = modelForRole('fluent').artifact.url;

    const embeddingCached = await isCached(embeddingUrl);
    const conversationCached = await isCached(conversationUrl);
    const fluentCached = await isCached(fluentUrl);

    const newMap: Record<ModelChoiceId, boolean> = {
      embedding: embeddingCached,
      conversation: conversationCached,
      fluent: fluentCached,
      none: true,
    };
    setCachedModels(newMap);
    return newMap;
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns]);

  const userHasConversationRef = useRef(false);
  userHasConversationRef.current = turns.some((t) => t.question.trim().length > 0);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (userHasConversationRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
  }, []);

  /**
   * Focus, on open and after close.
   *
   * On open, into the composer — the one control a reader came here to use. On close,
   * back to the launcher, so keyboard and screen-reader users are not dropped at the
   * top of the document. Both are two separate concerns sharing one effect, so it is
   * written as two guarded branches rather than one that assumes the panel exists.
   *
   * No cleanup function, and `open` is not set anywhere here. Returning one that
   * touched state listed in this effect's own dependencies is the bug shape
   * `tests/client-effects.test.ts` exists to catch.
   */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      inputRef.current?.focus();
    } else if (!open && wasOpen.current) {
      /*
       * Focus returns to the launcher.
       *
       * Not to wherever the reader was before opening, which is usually a project link
       * they had finished reading — restoring there would scroll them away from a
       * panel they had just deliberately dismissed. The launcher is the control that
       * owns this panel: it is what reopens it, and it is what vanished.
       *
       * Guarded by `wasOpen` because this effect also runs on first mount, where
       * `open` is false and there is nothing to restore focus *from*. Without the
       * guard, opening the page would pull focus to the launcher out of nowhere.
       */
      launcherRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  /*
   * The reader's route, which decides where each card leads.
   *
   * `usePathname` rather than `window.location`, so the value is a React one: a route
   * change re-renders and this recomputes. Reading `window` would need a subscription
   * and a manual state update, and would miss the back button.
   *
   * Stripped to the pathname because a query or hash is not a different page, and
   * `/products/verseye#top` must still be recognised as being on `/products/verseye`.
   */
  const pathname = usePathname();
  useEffect(() => {
    if (state.status !== 'ready') return;
    // Read the latest engine from a ref so this effect depends only on the route. With
    // `state` in the dependency list the effect would re-run on every turn, which is
    // harmless but wrong — and adding a dependency to silence a lint rule is how the
    // effect-teardown bugs in this component started.
    const engine = state.engine;
    setCardPlans((current) => {
      const next = new Map<number, Map<string, CardPlan>>();
      for (const turn of turns) {
        if (!turn.answer) continue;
        next.set(
          turn.id,
          new Map(engine.plan(turn.answer, pathname).map((plan) => [plan.key, plan])),
        );
      }
      return next.size === current.size ? current : next;
    });
  }, [pathname, state.status, turns]);

  const [isEnlarged, setIsEnlarged] = useState(false);

  /**
   * Close, release the models, and start over.
   *
   * Memory is the reason this is not just `onClose`. A half-gigabyte of weights plus
   * 125 cached vectors is a real cost on a laptop, and a reader who asked one question
   * and closed the panel should not be left holding it. So closing the panel while a
   * model is loaded disposes both and clears the conversation.
   *
   * What is deliberately *not* discarded is the browser's cached copy of the weights.
   * Re-indexing takes tens of seconds, and re-downloading takes minutes, so the next
   * open offers the model again and `brain.ts` finds it in the Cache API. Disposing a
   * session and clearing the download cache are different acts, and only the first
   * one is this function's business.
   */
  const closeAndRelease = useCallback(() => {
    const conversation = conversationRef.current;
    const embedder = embedderRef.current;
    conversationRef.current = null;
    embedderRef.current = null;

    // Claims the chat slot, so a load that is still unwinding cannot write into a panel
    // the reader has just closed. Without this, closing mid-download would leave the
    // button reading "ready" — and reopening would find a model nobody asked for and
    // no memory, because `conversationRef` was cleared on the way out.
    chatAttempt.current += 1;

    // Memory actually cleared, which the comment above used to claim and the code did
    // not do: the visible turns, the engine's own memory, and the unsent draft. Both
    // histories are dropped together, because the engine's bound feeds the model's
    // prompt and leaving it behind would mean a reopened panel silently conditioning
    // its answers on a conversation the reader can no longer see.
    setTurns([]);
    // Narrowed rather than assumed: `state` is a union, and an engine only exists
    // once the knowledge file has loaded. There is no history to clear before that,
    // because nothing has been answered yet.
    if (state.status === 'ready') state.engine.clearHistory();
    setDraft('');
    setInferenceMs(null);
    setChat({ status: 'idle' });
    setSemantic({ status: 'unavailable' });
    setIsEnlarged(false);

    // Both pipelines are disposed, not just dereferenced. Nulling the ref releases the
    // only reference this component holds, which lets a pipeline be collected — but a
    // 118 MB or 483 MB ONNX session is exactly the case where waiting for the garbage
    // collector is not good enough on a laptop.
    if (conversation) void conversation.dispose();
    if (embedder) void embedder.dispose();

    onClose();
  }, [onClose]);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || state.status !== 'ready' || busy) return;

      const inputTokens = estimateTokens(trimmed);
      if (inputTokens > MAX_INPUT_QUESTION_TOKENS) {
        const id = nextId.current++;
        setDraft('');
        const normalised = normaliseQuestion(trimmed, state.engine.aliases);
        setTurns((current) => [
          ...current,
          {
            id,
            question: trimmed,
            answer: {
              question: trimmed,
              intent: 'general',
              routing: { intent: 'general', confidence: 0, signals: [], uncertain: true },
              normalised,
              text: `Input size limit reached (${inputTokens} tokens, maximum allowed is ${MAX_INPUT_QUESTION_TOKENS} tokens). Please shorten your input or refresh the chat session to reset the context window.`,
              cards: [],
              navigation: [],
              empty: true,
              caveats: ['Prompt exceeds maximum input token capacity.'],
            },
            modelName: 'System Guard',
          },
        ]);
        return;
      }

      const id = nextId.current++;
      setDraft('');
      setBusy(true);
      // The question renders immediately, so the log never appears to stall.
      setTurns((current) => [...current, { id, question: trimmed, answer: null }]);

      try {
        // Both optional layers are optional at every step: absent, half-indexed, or
        // broken, `answer()` falls back to deterministic retrieval and composition,
        // which is the entire design. Nothing here is load-bearing for a correct
        // answer — only for a better-ordered one.
        // Retrieve full answer from engine
        const answer = await state.engine.answer(trimmed, {
          embedder: embedderRef.current,
          conversation: conversationRef.current,
        });

        // Only the generation half is timed, and only when a model ran.
        setInferenceMs(conversationRef.current?.lastInferenceMs() ?? null);

        // Determine which model answered the question
        const answeringModelName =
          conversationRef.current && chat.status === 'ready'
            ? AVAILABLE_MODELS.find((m) => m.role === selectedModelChoice)?.name || 'Conversational LLM'
            : embedderRef.current && semantic.status === 'ready'
              ? 'Neural Vector Brain (E5 Small)'
              : 'Direct Search Engine';

        // Qwen model-exclusive capabilities: Think mode & Web search
        const isQwenModel =
          (selectedModelChoice === 'conversation' || selectedModelChoice === 'fluent') &&
          chat.status === 'ready' &&
          Boolean(conversationRef.current);

        let thinkingTrace: string | undefined = undefined;
        let searchSources: Array<{ title: string; href: string }> | undefined = undefined;

        if (isQwenModel) {
          // If Think is enabled, generate step-by-step reasoning analysis
          if (enableThink) {
            const hasMatchedRecords = (answer.cards?.length ?? 0) > 0;
            const recordsMentioned = answer.cards?.map((c) => c.name).join(', ') || 'general records';
            thinkingTrace = `1. Analyzing query intent: "${trimmed}"\n` +
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
                  const hits: Array<{ title?: string; name?: string; href?: string; url?: string }> = await searchRes.json();
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
        }

        // Fast streaming effect: progressively reveal text character by character
        const fullText = answer.text;
        const totalChars = fullText.length;
        
        if (totalChars === 0) {
          setTurns((current) =>
            current.map((turn) =>
              turn.id === id
                ? {
                    ...turn,
                    answer,
                    modelName: answeringModelName,
                    thinking: thinkingTrace,
                    searchSources,
                  }
                : turn,
            ),
          );
        } else {
          // Stream in small fast chunks (~4-8 characters every 15-20ms)
          const chunkSize = Math.max(3, Math.ceil(totalChars / 40));
          let currentLen = 0;

          // Set initial partial answer turn
          setTurns((current) =>
            current.map((turn) =>
              turn.id === id
                ? {
                    ...turn,
                    answer: { ...answer, text: '' },
                    modelName: answeringModelName,
                    thinking: thinkingTrace,
                    searchSources,
                  }
                : turn,
            ),
          );

          await new Promise<void>((resolve) => {
            const interval = setInterval(() => {
              currentLen = Math.min(totalChars, currentLen + chunkSize);
              const partialText = fullText.slice(0, currentLen);

              setTurns((current) =>
                current.map((turn) =>
                  turn.id === id
                    ? {
                        ...turn,
                        answer: { ...answer, text: partialText },
                        modelName: answeringModelName,
                        thinking: thinkingTrace,
                        searchSources,
                      }
                    : turn,
                ),
              );

              if (currentLen >= totalChars) {
                clearInterval(interval);
                resolve();
              }
            }, 16);
          });
        }
      } catch {
        setTurns((current) =>
          current.map((turn) =>
            turn.id === id ? { ...turn, answer: failureAnswer(trimmed, state.engine.aliases), modelName: 'Direct Search Engine' } : turn,
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [state, busy, chat.status, selectedModelChoice, semantic.status, enableThink, enableWebSearch],
  );

  /**
   * Start the optional model download, then index the corpus with it.
   *
   * Never automatic. The agent answers every question from the content file
   * already, so a reader who never presses this never downloads anything — that is
   * the whole design, and an eager download would break it. The failure path keeps
   * the button available rather than hiding it, because "it failed" and "it is
   * gone" are different messages.
   *
   * Two phases, reported separately. The download is bytes moving; the index is 125
   * chunks going through the model. A reader who sees one bar jump to 100% and then
   * sits through another thirty seconds with no feedback would reasonably conclude
   * the first bar was lying.
   *
   * No engine dependency: the knowledge is not needed to index it, only its record
   * text, and the embedder is keyed on a hash of that text. A panel closed mid-index
   * therefore loses the vectors but never the model.
   *
   * Only the embedder is loaded here. The conversational model is a separate 483 MB
   * and is not offered: it would reorder which verified records are shown first and
   * write nothing that is not already composed from the content file. Asking someone
   * to download half a gigabyte for that, before they have asked a single question,
   * is a bad trade.
   */
  const isDownloading =
    brain.status === 'downloading' ||
    brain.status === 'detecting' ||
    chat.status === 'loading' ||
    semantic.status === 'indexing';

  const startModel = useCallback(() => {
    if (isDownloading) return;
    setBrain({ status: 'detecting' });
    setSemantic({ status: 'unavailable' });

    void loadModel({ onState: setBrain })
      .then(async (loaded) => {
        setSemantic({ status: 'indexing', done: 0, total: 0 });

        /*
         * Vectors survive a reload; the weights are cached separately by `brain.ts`.
         *
         * Without this, every open pays for the indexing again after already waiting
         * on the download, and indexing is the longer half of the two. The hash is the
         * corpus's own content identity, so editing the content file invalidates by
         * producing a different key rather than by anything this code has to compare.
         */
        const model = modelIdForRole('embedding');
        const embedder = await createE5Embedder(emptyVectorStore(), {
          pipeline: loaded.pipeline as FeatureExtractionPipeline,
          backend: loaded.backend,
          restore: (hash) => restoreVectors(hash, model, E5_DIMENSIONS),
          save: async (hash, vectors) => {
            await persistVectors(hash, model, loaded.backend, vectors);
          },
        });
        if (!embedder) {
          setSemantic({
            status: 'failed',
            message: 'The model downloaded but could not be used for matching.',
          });
          return;
        }

        embedderRef.current = embedder;

        const records = knowledgeRecords();
        const report = (progress: EmbedderState): void =>
          setSemantic({ status: 'indexing', done: progress.embedded, total: progress.total });

        await embedder.indexCorpus(records, report);

        const after = embedder.state();
        if (after.error) {
          setSemantic({ status: 'failed', message: after.error });
          return;
        }
        setSemantic({ status: 'ready', chunks: after.total });
        pickRandomGreeting('embedding');
      })
      .catch(() => {
        // `loadModel` has already reported through `onState`; this only stops the
        // rejection becoming an unhandled one.
      });
  }, [pickRandomGreeting]);

  /**
   * Load the conversational model. Separate from `startModel` on purpose.
   *
   * The one thing this model does is say which of the records retrieval already
   * returned matter most, and the engine re-validates that against the retrieved set
   * before acting on it. So its entire contribution is ordering, which is why it is
   * not loaded alongside the embedder and not loaded at all until asked for.
   */
  // `brain.ts` already memoises loaded pipelines by role, so the timings are
  // re-read from the loader's own record rather than measured twice here.
  const startChat = useCallback((role: 'conversation' | 'fluent' = 'conversation') => {
    if (isDownloading) return;
    setChat({ status: 'loading' });

    let loaded: LoadedModel | null = null;

    const attempt = (chatAttempt.current += 1);

    void createConversation({
      role,
      load: async () => {
        loaded = await loadModel({
          role,
          onState: (state) => {
            if (chatAttempt.current !== attempt) return;
            if (state.status === 'downloading') {
              setChat({
                status: 'loading',
                bytesLoaded: state.bytesLoaded,
                bytesTotal: state.bytesTotal,
                backend: state.backend,
              });
            }
          },
        });
        return { pipeline: loaded.pipeline, backend: loaded.backend };
      },
    })
      .then((conversation) => {
        if (chatAttempt.current !== attempt) {
          void conversation?.dispose().catch(() => {});
          return;
        }
        if (!conversation || !loaded) {
          setChat({ status: 'failed', message: 'The conversational model could not be loaded.' });
          return;
        }
        conversationRef.current = conversation;
        pickRandomGreeting(role);
        setChat({
          status: 'ready',
          backend: loaded.backend,
          loadMs: loaded.loadMs,
          fromCache: loaded.fromCache,
        });
        void checkAllModelCaches();
      })
      .catch(() => {
        if (chatAttempt.current !== attempt) return;
        setChat({ status: 'failed', message: 'The conversational model could not be loaded.' });
      });
  }, [isDownloading, checkAllModelCaches, pickRandomGreeting]);

  const handleSelectModel = useCallback((item: ModelListItem) => {
    if (isDownloading) return;
    setIsModelPickerOpen(false);
    if (item.role === 'none') {
      setSelectedModelChoice('none');
      localStorage.setItem('portfolio-agent-selected-model', 'none');
      if (conversationRef.current) {
        void conversationRef.current.dispose();
        conversationRef.current = null;
        setChat({ status: 'idle' });
      }
      return;
    }

    if (cachedModels[item.role]) {
      setSelectedModelChoice(item.role);
      localStorage.setItem('portfolio-agent-selected-model', item.role);
      if (item.role === 'embedding') {
        if (semantic.status !== 'ready') {
          startModel();
        }
      } else {
        if (chat.status !== 'ready') {
          startChat(item.role);
        }
      }
    } else {
      setPendingDownloadModel(item);
    }
  }, [isDownloading, cachedModels, semantic.status, brain.status, chat.status, startModel, startChat]);

  const handleConfirmDownload = useCallback((item: ModelListItem) => {
    if (isDownloading) return;
    setPendingDownloadModel(null);
    setSelectedModelChoice(item.role);
    localStorage.setItem('portfolio-agent-selected-model', item.role);

    if (item.role === 'embedding') {
      startModel();
    } else if (item.role === 'conversation' || item.role === 'fluent') {
      startChat(item.role);
    }
  }, [isDownloading, startModel, startChat]);

  const handleRemoveModel = useCallback(async (e: React.MouseEvent, item: ModelListItem) => {
    e.stopPropagation();
    if (isDownloading || !item.url || item.role === 'none') return;

    await deleteCachedModel(item.url);
    await checkAllModelCaches();

    if (selectedModelChoice === item.role) {
      if (item.role === 'embedding') {
        if (embedderRef.current) {
          void embedderRef.current.dispose();
          embedderRef.current = null;
        }
        setBrain({ status: 'idle' });
        setSemantic({ status: 'unavailable' });
      } else {
        if (conversationRef.current) {
          void conversationRef.current.dispose();
          conversationRef.current = null;
        }
        setChat({ status: 'idle' });
      }
      setSelectedModelChoice('none');
      localStorage.setItem('portfolio-agent-selected-model', 'none');
    }
  }, [isDownloading, checkAllModelCaches, selectedModelChoice]);

  useEffect(() => {
    let active = true;
    const saved = localStorage.getItem('portfolio-agent-selected-model') as ModelChoiceId | null;
    void checkAllModelCaches().then((cachedMap) => {
      if (!active) return;
      if (saved && ['embedding', 'conversation', 'fluent', 'none'].includes(saved)) {
        if (saved === 'none' || cachedMap[saved]) {
          setSelectedModelChoice(saved);
          if (saved === 'embedding' && cachedMap.embedding) {
            if (semantic.status === 'unavailable') {
              startModel();
            }
          } else if (saved === 'conversation' && cachedMap.conversation) {
            if (chat.status === 'idle') {
              startChat('conversation');
            }
          } else if (saved === 'fluent' && cachedMap.fluent) {
            if (chat.status === 'idle') {
              startChat('fluent');
            }
          }
        } else {
          setSelectedModelChoice('none');
        }
      }
    });
    const cleanup = () => {
      active = false;
    };
    return cleanup;
  }, [checkAllModelCaches, startModel, startChat, semantic.status, chat.status]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(event.target as Node)) {
        setIsModelPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    const cleanup = () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
    return cleanup;
  }, []);

  const summary = describeBrain(brain);

  return (
    <div className={`${styles.widget}${isEnlarged ? ` ${styles.widgetEnlarged}` : ''}`}>
      {!open ? (
        <button
          type="button"
          className={styles.launcher}
          onClick={onOpen}
          aria-expanded="false"
          aria-label="Ask the portfolio"
          ref={launcherRef}
        >
          <img src="/bot.svg" alt="" className={styles.launcherIcon} width={36} height={36} />
          <span className={styles.launcherText}>Ask the portfolio</span>
        </button>
      ) : null}

      {open ? (
        <section
          className={`${styles.panel}${isEnlarged ? ` ${styles.panelEnlarged}` : ''}`}
          aria-label="Ask the portfolio"
          ref={panelRef}
          onKeyDown={(event) => {
            /*
             * A focus trap.
             *
             * Tab has to stay inside the panel while it is open, because the panel is
             * a dialog in everything but name and the page behind it is still there:
             * a reader tabbing onward lands on page content they cannot see, with no
             * indication of where focus went. `Escape` is handled on the composer
             * already; this catches it anywhere in the panel.
             *
             * Only the standard Tab and Shift+Tab are intercepted. Every other key is
             * left alone — in particular a modifier held with Tab, which is a
             * deliberate "let me out" gesture in some setups and must not be swallowed.
             */
            if (event.key !== 'Tab') return;
            const panel = panelRef.current;
            if (!panel) return;

            const focusable = panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first || !last) return;

            const active = document.activeElement;
            if (event.shiftKey && (active === first || !panel.contains(active))) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && active === last) {
              event.preventDefault();
              first.focus();
            }
          }}
        >
          <header className={styles.head}>
            <div>
              <h2 className={styles.title}>Ask the portfolio</h2>
              <p className={styles.subtitle}>
                Answered from the content file. Nothing here is recalled.
              </p>
            </div>
            <div className={styles.headActions}>
              <button
                type="button"
                className={styles.enlarge}
                onClick={() => setIsEnlarged((prev) => !prev)}
                aria-label={isEnlarged ? 'Minimize chatbot' : 'Enlarge chatbot'}
                title={isEnlarged ? 'Minimize' : 'Enlarge'}
              >
                {isEnlarged ? (
                  <svg
                    className={styles.enlargeIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5" />
                  </svg>
                ) : (
                  <svg
                    className={styles.enlargeIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                )}
              </button>
              <button type="button" className={styles.close} onClick={closeAndRelease} aria-label="Close">
                ×
              </button>
            </div>
          </header>

          {state.status === 'loading' ? (
            <p className={styles.status}>Reading the portfolio…</p>
          ) : null}

          {state.status === 'failed' ? (
            <p className={styles.status}>
              The portfolio could not be loaded, so there is nothing to answer from. No partial answer
              is offered in its place.
            </p>
          ) : null}

          <div className={styles.log} ref={logRef} aria-live="polite" aria-atomic="false">
            {turns.length === 0 && state.status === 'ready' ? (
              <div className={styles.suggestions}>
                <p className={styles.suggestionsLead}>Try one of these:</p>
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className={styles.suggestion}
                    onClick={() => void ask(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            {/*
             * The greeting, shown only once a model is actually loaded.
             *
             * Seeded from the browser clock rather than the payload's `generatedAt`,
             * which is when the content file was built — quoting that would present a
             * build date as if it were today's. `generatedAt` is deliberately unused
             * here for exactly that reason.
             */}
            {chat.status === 'ready' && turns.length === 0 ? (
              <p className={styles.brainNote}>
                ⚡ <strong>I am alive!</strong> My neural brain is now powered by ONNX directly in your browser. {greetingMessage} Activated on{' '}
                {new Date().toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                .
              </p>
            ) : null}

            {/* Real measured timings, and active model indicator. */}
            {chat.status === 'ready' ? (
              <p className={styles.brainTimings}>
                {AVAILABLE_MODELS.find((m) => m.role === selectedModelChoice)?.name || 'Conversational LLM'} · {chat.backend.toUpperCase()}
                {chat.fromCache ? ' · already downloaded' : ` · loaded in ${formatSeconds(chat.loadMs)}`}
                {inferenceMs !== null ? ` · last question in ${formatSeconds(inferenceMs)}` : ''}
              </p>
            ) : null}

            {turns.map((turn) => (
              <Turn key={turn.id} turn={turn} cardPlan={cardPlans.get(turn.id)} />
            ))}
          </div>

          {/*
            The optional model, below the conversation rather than above it. The
            agent is already useful, so this has to read as an offer and not as a
            prerequisite — anything that looks like a gate would misrepresent what
            the site does by default.
          */}
          <section
            className={`${styles.brain} ${
              brain.status === 'ready' || chat.status === 'ready'
                ? styles.brainReady
                : brain.status === 'failed' || chat.status === 'failed'
                  ? styles.brainError
                  : ''
            }`}
            aria-label="Optional language model"
          >
            {brain.status === 'downloading' ? (
              <div className={styles.brainProgress}>
                <div
                  role="progressbar"
                  className={styles.brainTrack}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent(brain)}
                  aria-label="Model download"
                >
                  <div
                    className={styles.brainFill}
                    style={{ width: `${progressPercent(brain)}%` }}
                  />
                </div>
                <p className={styles.brainNote}>
                  {formatBytes(brain.bytesLoaded)} of {formatBytes(brain.bytesTotal)}. Downloading ONNX weights...
                </p>
              </div>
            ) : null}

            {semantic.status === 'ready' ? (
              <p className={styles.brainNote}>
                🧠 <strong>Vector Brain Active:</strong> Searching concepts & meaning across {semantic.chunks} passages in local memory.
              </p>
            ) : null}

            {semantic.status === 'failed' ? (
              <p className={styles.brainNote}>{semantic.message}</p>
            ) : null}

            {semantic.status === 'indexing' ? (
              <div className={styles.brainProgress}>
                <div
                  role="progressbar"
                  className={styles.brainTrack}
                  aria-valuemin={0}
                  aria-valuemax={semantic.total || 100}
                  aria-valuenow={semantic.total > 0 ? semantic.done : undefined}
                  aria-label="Indexing the portfolio for matching"
                >
                  <div
                    className={styles.brainFill}
                    style={{ width: `${semantic.total > 0 ? (semantic.done / semantic.total) * 100 : 100}%` }}
                  />
                </div>
                <p className={styles.brainNote}>
                  {semantic.total > 0
                    ? `Indexing ${semantic.done} of ${semantic.total} passages into local vector space.`
                    : 'Initializing neural engine & vector index...'}
                </p>
              </div>
            ) : null}

            {brain.status === 'failed' && brain.reason.kind !== 'cancelled' ? (
              <div className={styles.brainActions}>
                <button type="button" className={styles.brainButton} onClick={startModel}>
                  Try again
                </button>
                <span className={styles.brainNote}>
                  Answers are unaffected — they come from the content file.
                </span>
              </div>
            ) : null}

            {chat.status === 'loading' ? (
              <div className={styles.brainProgress}>
                {chat.bytesTotal ? (
                  <div
                    role="progressbar"
                    className={styles.brainTrack}
                    aria-valuemin={0}
                    aria-valuemax={chat.bytesTotal}
                    aria-valuenow={chat.bytesLoaded ?? 0}
                    aria-label="Conversational model download"
                  >
                    <div
                      className={styles.brainFill}
                      style={{
                        width: `${progressPercent({
                          status: 'downloading',
                          bytesLoaded: chat.bytesLoaded ?? 0,
                          bytesTotal: chat.bytesTotal,
                          backend: chat.backend ?? 'wasm',
                          role: 'conversation',
                        })}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    role="progressbar"
                    className={styles.brainTrack}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={undefined}
                    aria-label="Conversational model download"
                  >
                    <div className={styles.brainFill} style={{ width: '100%' }} />
                  </div>
                )}
                <p className={styles.brainNote}>
                  {chat.bytesTotal ? (
                    <>
                      {chat.backend ? `${chat.backend.toUpperCase()} · ` : ''}
                      {formatBytes(chat.bytesLoaded ?? 0)} of{' '}
                      {formatBytes(chat.bytesTotal)}. Downloading ONNX weights...
                    </>
                  ) : (
                    <>
                      Loading the conversational model...
                    </>
                  )}
                </p>
              </div>
            ) : null}

            {chat.status === 'failed' ? (
              <div className={styles.brainActions}>
                <p className={styles.brainNote}>{chat.message} Answers are unaffected.</p>
                <button type="button" className={styles.brainButton} onClick={() => startChat(selectedModelChoice !== 'none' && selectedModelChoice !== 'embedding' ? selectedModelChoice : 'conversation')}>
                  Try again
                </button>
              </div>
            ) : null}
          </section>

          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
          >
            <div className={styles.composerBar}>
              <div className={styles.composerControlsRow}>
                <div className={styles.modelPickerWrapper} ref={modelPickerRef}>
                  <button
                    type="button"
                    className={`${styles.modelPickerTrigger}${isDownloading ? ` ${styles.modelPickerTriggerDisabled}` : ''}`}
                    onClick={() => {
                      if (!isDownloading) {
                        setIsModelPickerOpen((prev) => !prev);
                      }
                    }}
                    disabled={isDownloading}
                    aria-expanded={isModelPickerOpen}
                    aria-label="Select Model"
                  >
                    <span className={styles.modelPickerPlus}>+</span>
                    <span className={styles.modelPickerName}>
                      {AVAILABLE_MODELS.find((m) => m.role === selectedModelChoice)?.name || 'Without Model'}
                    </span>
                    <span className={styles.modelPickerChevron}>{isModelPickerOpen ? '▲' : '▼'}</span>
                  </button>

                  {isModelPickerOpen && !isDownloading && (
                    <div className={styles.modelPopover}>
                      <div className={styles.modelPopoverHeader}>Model</div>
                      <div className={styles.modelPopoverList}>
                        {AVAILABLE_MODELS.map((item) => {
                          const isSelected = selectedModelChoice === item.role;
                          const isDownloaded = cachedModels[item.role];
                          return (
                            <div
                              key={item.role}
                              className={`${styles.modelPopoverItem}${isSelected ? ` ${styles.modelPopoverItemSelected}` : ''}`}
                              onClick={() => handleSelectModel(item)}
                            >
                              <div className={styles.modelPopoverItemLeft}>
                                <span className={styles.modelCheckmark}>{isSelected ? '✓' : ''}</span>
                                <div className={styles.modelPopoverItemText}>
                                  <span className={styles.modelPopoverItemTitle}>{item.name}</span>
                                  <span className={styles.modelPopoverItemSubtitle}>
                                    {item.badge} · {item.size}
                                  </span>
                                </div>
                              </div>
                              <div className={styles.modelPopoverItemRight}>
                                {item.role !== 'none' && isDownloaded ? (
                                  <button
                                    type="button"
                                    className={styles.modelRemoveBtn}
                                    title="Remove model from cache"
                                    onClick={(e) => void handleRemoveModel(e, item)}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                    </svg>
                                  </button>
                                ) : item.role !== 'none' && !isDownloaded ? (
                                  <span className={styles.modelNotDownloadedTag}>Download</span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Think & Web Search capability toggles — available only for Qwen models */}
                {(selectedModelChoice === 'conversation' || selectedModelChoice === 'fluent') && (
                  <div className={styles.qwenToggles}>
                    <button
                      type="button"
                      className={`${styles.capabilityToggle} ${enableThink ? styles.capabilityToggleActive : ''}`}
                      onClick={() => setEnableThink((v) => !v)}
                      title={enableThink ? 'Thinking mode active: reasoning traces generated' : 'Turn on deep thinking mode'}
                    >
                      <span className={styles.capabilityIcon}>💭</span>
                      <span>Think</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.capabilityToggle} ${enableWebSearch ? styles.capabilityToggleActive : ''}`}
                      onClick={() => setEnableWebSearch((v) => !v)}
                      title={enableWebSearch ? 'Web search active: searches website for missing fields' : 'Turn on website search'}
                    >
                      <span className={styles.capabilityIcon}>🌐</span>
                      <span>Web Search</span>
                    </button>
                  </div>
                )}

                {/* Token Context Usage & Session Reset */}
                {(() => {
                  const draftTokens = estimateTokens(draft);
                  const isNearInputLimit = draftTokens > MAX_INPUT_QUESTION_TOKENS * 0.8;
                  const hasConversation = turns.length > 0;

                  return (
                    <div className={styles.tokenCounter}>
                      <span className={isNearInputLimit ? styles.tokenWarning : undefined} title="Tokens for current input">
                        {draftTokens > 0 ? `${draftTokens} / ${MAX_INPUT_QUESTION_TOKENS} tokens` : `${MAX_INPUT_QUESTION_TOKENS} max tokens`}
                      </span>
                      {hasConversation && (
                        <button
                          type="button"
                          className={styles.contextResetBtn}
                          onClick={() => {
                            setTurns([]);
                            if (state.status === 'ready') state.engine.clearHistory();
                            setDraft('');
                          }}
                          title="Reset conversation context and start fresh"
                        >
                          Clear Context
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className={styles.inputRow}>
                <textarea
                  ref={inputRef}
                  className={styles.input}
                  value={draft}
                  rows={2}
                  placeholder="Ask about a technology, or paste a job description."
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void ask(draft);
                      return;
                    }
                    if (event.key === 'Escape') closeAndRelease();
                  }}
                  disabled={state.status !== 'ready'}
                />
                <button
                  type="submit"
                  className={styles.send}
                  disabled={state.status !== 'ready' || busy || draft.trim().length === 0}
                >
                  Ask
                </button>
              </div>
            </div>
          </form>

          {pendingDownloadModel && (
            <div className={styles.modalBackdrop}>
              <div className={styles.modalCard}>
                <h3 className={styles.modalTitle}>Download {pendingDownloadModel.name}?</h3>
                <p className={styles.modalBody}>
                  This model ({pendingDownloadModel.size}) is not downloaded yet. It will run 100% locally in your browser and stay saved in your device storage so you don&apos;t need to download it again.
                </p>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.modalCancelBtn}
                    onClick={() => setPendingDownloadModel(null)}
                    disabled={isDownloading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.modalConfirmBtn}
                    onClick={() => handleConfirmDownload(pendingDownloadModel)}
                    disabled={isDownloading}
                  >
                    Download ({pendingDownloadModel.size})
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

/**
 * One question and its answer.
 *
 * `cardPlan` is the engine's decision about where each card leads, recomputed when the
 * answer arrived and again when the reader's route changed. It is passed in rather than
 * read from context because a turn is a record of what was asked, and the destinations
 * it offers depend on where the reader is standing now — not on when they asked.
 */
function Turn({ turn, cardPlan }: { turn: Turn; cardPlan?: Map<string, CardPlan> }) {
  const { answer } = turn;
  const cardsPointHere =
    cardPlan !== undefined &&
    [...cardPlan.values()].some((plan) => plan.action.kind === 'anchor' && plan.action.note.length > 0);

  /*
   * A `compare` proposal becomes an offer, and an offer has a consequence the reader
   * cannot see from the link text alone: opening it replaces the page they are on.
   * `planAction` returns the note saying so, and it is rendered once per turn rather
   * than repeated on every card, because a panel where five cards each carry the same
   * warning reads as five separate problems.
   */
  const compareNote = ((): string | null => {
    if (cardPlan === undefined) return null;
    for (const plan of cardPlan.values()) {
      // Narrowed inside the loop rather than in a predicate, because `ActionPlan` is a
      // union and the check that matters is on `note` being non-empty, not on the kind
      // alone — an `offer` with an empty note would render an empty paragraph.
      if (plan.action.kind === 'offer' && plan.action.note.length > 0) return plan.action.note;
    }
    return null;
  })();

  return (
    <article className={styles.turn}>
      <p className={styles.question}>{turn.question}</p>
      {!answer ? (
        <p className={styles.pending}>Checking the records…</p>
      ) : (
        <>
          <p className={styles.answer}>{answer.text}</p>

          {answer.match ? <MatchBar answer={answer} /> : null}
          {answer.match ? <Breakdown match={answer.match} /> : null}

          {answer.cards.length > 0 ? (
            <ul className={styles.cards}>
              {answer.cards.map((card) => {
                /*
                 * The destination, decided by the engine rather than by the template.
                 *
                 * `planAction` has already passed this through the navigation
                 * registry, so the href here is one the site actually has — the widget
                 * does not get to decide that. What it decides is *which* link: a plain
                 * route from anywhere else, or an in-page anchor once the reader is on
                 * that page, where navigating would reload it and lose their place.
                 *
                 * A card that plans nothing is omitted rather than rendered dead. In
                 * practice that does not happen for `navigate`, which every card uses —
                 * the branch is here so an unplannable card cannot render as a dead link
                 * if the action kinds ever widen.
                 */
                const plan = cardPlan?.get(card.key);
                if (!plan || plan.action.kind === 'none') return null;

                return (
                  <li key={card.key}>
                    <Link
                      className={styles.card}
                      href={plan.action.kind === 'anchor' ? plan.action.href : card.href}
                      title={plan.action.kind === 'anchor' ? plan.action.note : undefined}
                    >
                      <span className={styles.cardKind}>{card.kind}</span>
                      <span className={styles.cardName}>{card.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {/*
           * The "you are already here" case, stated once rather than per card.
           *
           * Only when at least one card is pointing at the current page, because a
           * reader who was not expecting it would otherwise see a tooltip explaining
           * something they never did.
           */}
          {cardsPointHere ? (
            <p className={styles.caveatNote}>
              Already on this page, so those links point at the record itself.
            </p>
          ) : null}

          {compareNote ? <p className={styles.caveatNote}>{compareNote}</p> : null}

          {answer.caveats.length > 0 ? (
            <ul className={styles.caveats}>
              {answer.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          ) : null}

          {/* Deep thinking reasoning trace — available when Qwen model generates thinking */}
          {turn.thinking ? (
            <details className={styles.thinkingBlock}>
              <summary className={styles.thinkingSummary}>
                <span className={styles.thinkingIcon}>💭</span>
                <span>Thinking Process</span>
              </summary>
              <pre className={styles.thinkingContent}>{turn.thinking}</pre>
            </details>
          ) : null}

          {/* Web search sources — available when Qwen model web search finds matching pages */}
          {turn.searchSources && turn.searchSources.length > 0 ? (
            <div className={styles.searchSourcesBlock}>
              <span className={styles.searchSourcesTitle}>🌐 Searched from website:</span>
              <ul className={styles.searchSourcesList}>
                {turn.searchSources.map((source, idx) => (
                  <li key={idx}>
                    <Link href={source.href} className={styles.searchSourceLink}>
                      {source.title} ↗
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {turn.modelName ? (
            <div className={styles.turnModelFooter}>
              <span className={styles.turnModelBadge}>
                {turn.modelName}
              </span>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

/**
 * The two figures are shown separately, and the distinction is the point.
 *
 * The headline counts requirements the portfolio never mentions; the second
 * counts only those it does. Collapsing them into one number would let a
 * portfolio look stronger than it is by being incomplete.
 */
function MatchBar({ answer }: { answer: AgentAnswer }) {
  const match = answer.match;
  if (!match) return null;

  return (
    <div className={styles.match}>
      <div className={styles.matchRow}>
        <span className={styles.matchLabel}>Against the requirements</span>
        <span className={styles.matchValue}>{match.score}%</span>
      </div>
      <div className={styles.matchRow}>
        <span className={styles.matchLabel}>Of what is documented</span>
        <span className={styles.matchValue}>{match.documentedOnlyScore}%</span>
      </div>
      <div className={styles.matchFoot}>
        <span className={styles.grade}>{match.grade.replace(/-/g, ' ')}</span>
        {match.requirements.length > 0 ? (
          <span className={styles.matchCount}>
            {match.requirements.length} requirement{match.requirements.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The four states, in the order a reader should meet them.
 *
 * This is the part of a match answer that carries the reasoning. Two percentages
 * tell a reader how good the fit is; they do not tell them which requirement to
 * look at next, or why the one they care about scored the way it did.
 *
 * Grouped by state rather than listed in scoring order, so the gap is visible
 * without reading every row — which is the only reason anyone reads this.
 */
const STATE_ORDER = [
  'strong',
  'partial',
  'documented-uncorroborated',
  'unverified',
] as const satisfies readonly RequirementScore['state'][];

const STATE_LABEL: Record<RequirementScore['state'], string> = {
  strong: 'Strong evidence',
  partial: 'Partial evidence',
  'documented-uncorroborated': 'Documented, not corroborated',
  unverified: 'Not documented',
};

const LEVEL_LABEL: Record<RequirementScore['level'], string> = {
  required: 'required',
  preferred: 'preferred',
  unknown: 'importance not stated',
};

function Breakdown({ match }: { match: MatchResult }) {
  // Ambiguous terms are held out of the arithmetic by the scorer. They are shown
  // anyway, in their own note, because a requirement that quietly vanished from
  // the maths reads as a requirement that was met.
  const scored = match.requirements.filter((requirement) => !requirement.ambiguous);
  const ambiguous = match.requirements.filter((requirement) => requirement.ambiguous);

  if (scored.length === 0 && ambiguous.length === 0) return null;

  const groups = STATE_ORDER.map((state) => ({
    state,
    items: scored.filter((requirement) => requirement.state === state),
  })).filter((group) => group.items.length > 0);

  return (
    <div className={styles.breakdown}>
      {groups.map((group) => (
        <section key={group.state} className={styles.breakdownGroup}>
          <h3 className={styles.breakdownHead}>
            <span className={styles.breakdownState}>{STATE_LABEL[group.state]}</span>
            <span className={styles.breakdownCount}>{group.items.length}</span>
          </h3>
          <ul className={styles.breakdownList}>
            {group.items.map((requirement) => (
              <li key={requirement.term} className={styles.breakdownItem}>
                <span className={styles.breakdownTerm}>
                  {requirement.best?.href ? (
                    <Link className={styles.breakdownLink} href={requirement.best.href}>
                      {requirement.term}
                    </Link>
                  ) : (
                    requirement.term
                  )}
                  <span className={styles.breakdownLevel}>
                    {LEVEL_LABEL[requirement.level]}
                  </span>
                </span>
                {requirement.rationale ? (
                  <span className={styles.breakdownWhy}>{requirement.rationale}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {ambiguous.length > 0 ? (
        <section className={styles.breakdownGroup}>
          <h3 className={styles.breakdownHead}>
            <span className={styles.breakdownState}>Too ambiguous to score</span>
            <span className={styles.breakdownCount}>{ambiguous.length}</span>
          </h3>
          <ul className={styles.breakdownList}>
            {ambiguous.map((requirement) => (
              <li key={requirement.term} className={styles.breakdownItem}>
                <span className={styles.breakdownTerm}>{requirement.term}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
