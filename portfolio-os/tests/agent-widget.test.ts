/**
 * tests/agent-widget.test.ts
 *
 * Checks that every class the widget uses is one its stylesheet defines.
 *
 * There is no render test here, and there cannot easily be one: the suite runs
 * under `--conditions=react-server`, which `react-dom/server` refuses, and
 * `tsx` cannot parse the CSS module import, so the component cannot even be
 * imported into a Node test. A React testing dependency is not worth adding to
 * guard a presentational component.
 *
 * What is worth guarding is the failure that produces no error at all: a typo in
 * one class name renders as unstyled markup, silently, in a browser. Reading both
 * files catches that without any of the above.
 *
 * The widget's *behaviour* is covered by `tests/agent-wire.test.ts`, which runs
 * the same rehydrate-then-answer path the browser runs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'components/agent/AgentWidget.tsx'),
  'utf8',
);
const stylesheet = readFileSync(
  resolve(process.cwd(), 'components/agent/AgentWidget.module.css'),
  'utf8',
);
const tokens = readFileSync(resolve(process.cwd(), 'styles/tokens.css'), 'utf8');

/** Class selectors at the start of a rule, ignoring nested ones. */
function declaredClasses(css: string): Set<string> {
  const names = new Set<string>();
  for (const match of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
    if (match[1]) names.add(match[1]);
  }
  return names;
}

function usedClasses(tsx: string): Set<string> {
  const names = new Set<string>();
  for (const match of tsx.matchAll(/styles\.([\w-]+)/g)) {
    if (match[1]) names.add(match[1]);
  }
  return names;
}

test('every class the widget uses is declared by its stylesheet', () => {
  const declared = declaredClasses(stylesheet);
  const used = usedClasses(source);

  assert.ok(used.size > 0, 'no styles.* references found — has the widget stopped being styled?');

  const missing = [...used].filter((name) => !declared.has(name)).sort();
  assert.deepEqual(missing, [], `unstyled markup: ${missing.map((n) => `.${n}`).join(', ')}`);
});

test('every token the widget uses is defined', () => {
  // This is the check that earns its keep. A CSS module has no type system: a
  // misspelled or invented token resolves to nothing, and the rule silently
  // loses its colour, padding or radius with no error anywhere. Every token is
  // themed — the sepia and light sets redefine the whole palette — so a hard-coded
  // value shows up as a dark panel on a light page.
  const declared = new Set(
    [...tokens.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1] as string),
  );
  const used = new Set(
    [...stylesheet.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1] as string),
  );

  assert.ok(used.size > 0, 'no var(--token) references found');

  const missing = [...used].filter((token) => !declared.has(token)).sort();
  assert.deepEqual(missing, [], `undefined token(s): ${missing.join(', ')}`);
});

test('the widget defines no fallback for a token', () => {
  // `var(--typo, 8px)` hides a broken token behind a plausible value. The rule
  // renders, so nothing reports the mistake. Failsafes belong in tokens.css,
  // where there is one definition to reason about rather than many uses.
  const fallbacks = [...stylesheet.matchAll(/var\((--[a-z0-9-]+)\s*,/g)].map(
    (match) => match[1] as string,
  );

  assert.deepEqual(fallbacks, [], `token(s) with an inline fallback: ${fallbacks.join(', ')}`);
});

test('the stylesheet carries no literal colours', () => {
  const withoutShadows = stylesheet.replace(
    /(^|[;{])\s*box-shadow\s*:[^;}]*/g,
    '$1',
  );
  const literals =
    withoutShadows.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(/g) ?? [];

  assert.deepEqual(literals, [], `literal colour(s) in the stylesheet: ${literals.join(', ')}`);
});

test('the widget is a client component and imports no server module', () => {
  assert.match(source, /^'use client';/);

  // `server-only` throws on import in a client bundle. Naming it here means the
  // check is about the source rather than about whether a build happened.
  const serverImports = [...source.matchAll(/from\s+'([^']+)'/g)]
    .map((match) => match[1] ?? '')
    .filter((specifier) => specifier.startsWith('server-only') || specifier.startsWith('node:'));

  assert.deepEqual(serverImports, [], `client component imports server code: ${serverImports.join(', ')}`);
});

/* --------------------------------- model UI honesty, checked statically */

/**
 * The panel's figures are the claim most easily faked, so they get their own checks.
 *
 * These are static reads of the source, not render tests — for the same reason the
 * rest of this file is. What they guard is a specific and quiet failure: a hard-coded
 * duration or download size reads as a measurement to a reader, and there is no
 * runtime error when it is wrong.
 */

test('no duration in the panel is a literal', () => {
  // Every timing must arrive from `Date.now()` somewhere. A bare number in a string
  // like "loads in 2s" would render as a measurement of nothing.
  const durations = [...source.matchAll(/(?:loaded in|reply in|load time|inference)\D{0,20}(\d+(?:\.\d+)?)\s*s/gi)];
  assert.deepEqual(
    durations.map((match) => match[0]),
    [],
    `literal duration(s) in the panel: ${durations.map((m) => m[0]).join(', ')}`,
  );
});

test('every timing rendered comes from a measured value', () => {
  // `formatSeconds` is the only thing allowed to turn a duration into text, and it
  // takes a number it did not invent.
  assert.match(source, /function formatSeconds\(ms: number\)/);
  assert.doesNotMatch(
    source,
    /function formatSeconds\(\)\s*\{\s*return\s*['"`]/,
    'formatSeconds must not ignore its argument',
  );

  // Both call sites pass a prop or state that came from the loader.
  // Only the call sites matter — the signature match above already covers the
  // declaration, and reading it back as a "call" produced a false failure.
  const calls = [...source.matchAll(/formatSeconds\(([^)]*)\)/g)].map((match) => match[1] ?? '');
  const body = source.slice(source.indexOf('const summary = describeBrain'));
  const renderCalls = calls.filter((call) => body.includes(`formatSeconds(${call})`));
  assert.ok(
    renderCalls.length >= 2,
    `expected both a load and an inference figure, saw ${renderCalls.length}`,
  );
  for (const call of renderCalls) {
    assert.ok(
      /\b(loadMs|inferenceMs)\b/.test(call),
      `formatSeconds called with something unmeasured: ${call}`,
    );
  }
});

test('the panel states what the conversational model can and cannot do', () => {
  // It reorders records. It does not author answers. A reader deciding whether to
  // spend 483 MB deserves both halves stated, and an earlier draft oversold it as a
  // language model that would write the answers.
  assert.match(source, /cannot change the wording, the score, or what is documented/);
  assert.doesNotMatch(
    source,
    /A local language model/,
    'the panel must not call the embedder a language model — it embeds, it does not generate',
  );
});

test('the conversational download reports real byte progress', () => {
  // 483 MB behind an indeterminate bar is the case where a reader most needs to know
  // it is still moving, and it is the largest download the widget offers. `startChat`
  // had no `onState` at all, so the loader's `progress_callback` was never relayed.
  const startChat = source.slice(
    source.indexOf('const startChat'),
    source.indexOf('const summary = describeBrain'),
  );
  assert.ok(startChat.length > 0, 'startChat was not found');
  assert.match(startChat, /loadModel\(\{/, 'startChat must configure the loader');
  assert.match(
    startChat,
    /onState: \(state\)/,
    'startChat must forward the loader progress states',
  );
  assert.match(
    startChat,
    /state\.status === 'downloading'/,
    'only downloading states carry bytes, and they are the ones to show',
  );
  assert.match(
    startChat,
    /bytesLoaded: state\.bytesLoaded/,
    'the loader counts must be relayed rather than re-measured or estimated',
  );

  // The bar must be measured when bytes exist, and stay indeterminate when they do not.
  const chatBlock = source.slice(source.indexOf("chat.status === 'loading' ? ("));
  assert.match(chatBlock, /chat\.bytesTotal \?/, 'the bar branches on whether bytes are known');
  assert.match(chatBlock, /aria-valuenow=\{chat\.bytesLoaded \?\? 0\}/, 'the measured bar needs a value');
  assert.match(chatBlock, /aria-valuenow=\{undefined\}/, 'the unknown-total bar stays indeterminate');
  assert.match(chatBlock, /formatBytes\(chat\.bytesTotal\)/, 'the note must show real totals');

  // And a stale load must not keep painting the bar after a retry supersedes it. The
  // guard is the shared attempt ref rather than a per-call flag, because a per-call flag
  // is only cleared by its own cleanup and so cannot tell two live attempts apart.
  assert.match(
    startChat,
    /if \(chatAttempt\.current !== attempt\) return;/,
    'progress from a superseded load must be ignored',
  );
});

test('the two models are priced separately, and each button quotes its own model', () => {
  // Two buttons, two downloads. Quoting the combined 688 MB on the embedder button
  // asks for 205 MB and says 688 MB — an over-quote the reader cannot check against
  // their own network, which is what makes an optional download feel mandatory.
  assert.match(source, /coldBytes\(\['conversation'\]\)/, 'the conversation offer quotes its own model');
  assert.match(
    source,
    /coldLoadSummary\(backend, \['embedding'\]\)/,
    'the embedder offer must quote the embedder, not the combined cold-load total',
  );

  // No call may fall back to the combined default, since that default is both roles.
  assert.doesNotMatch(
    source,
    /coldLoadSummary\(backend\)/,
    'coldLoadSummary must always be given explicit roles',
  );
});

test('the greeting is not derived from the content build date', () => {
  // `generatedAt` is when the content file was built. Quoting it would present a
  // build date as though it were today.
  assert.match(source, /new Date\(\)/, 'the greeting seeds from the browser clock');
  // Comments may name `generatedAt` to explain why it is unused, so the check runs
  // against code with comments and block comments removed. A read of it in executable
  // code is what would present a build date as a currency date.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.doesNotMatch(code, /generatedAt/, 'the payload build date must not be read by the widget');
});

test('the panel never quotes a download size it did not measure', () => {
  // Sizes come from the registry, which verified each URL and read each byte count
  // from HuggingFace. A literal in the component would be a figure that cannot be
  // re-verified without reading the component.
  const literals = [...source.matchAll(/>\s*(\d+(?:\.\d+)?)\s*(MB|GB)\s*</g)];
  assert.deepEqual(
    literals.map((match) => match[0]),
    [],
    `literal download size(s): ${literals.map((m) => m[0]).join(', ')}`,
  );
});

test('closing the panel releases the models and the memory', () => {
  // Half a gigabyte of weights is a real cost. A close handler that does not dispose
  // leaves the reader holding it for the rest of the session.
  assert.match(source, /conversation\.dispose\(\)/, 'the conversation pipeline is disposed on close');
  assert.match(source, /embedderRef\.current = null/, 'the embedder reference is dropped on close');

  // Nulling the embedder ref was previously the *whole* of its release: the 118 MB
  // ONNX session survived until the collector got round to it. Dropped and disposed
  // are different acts and both are needed.
  assert.match(
    source,
    /if \(embedder\) void embedder\.dispose\(\)/,
    'the embedder pipeline is disposed, not merely dereferenced',
  );

  // Memory, too — the handler's own comment claimed this and the code did not do it.
  assert.match(source, /setTurns\(\[\]\)/, 'the visible conversation is cleared');
  assert.match(source, /clearHistory\(\)/, 'the engine\'s own memory is cleared');
  assert.match(source, /setDraft\(''\)/, 'the unsent draft is cleared');

  // And it is wired to both exits, not just the button.
  assert.match(source, /className=\{styles\.close\} onClick=\{closeAndRelease\}/);
  assert.match(source, /event\.key === 'Escape'\) closeAndRelease\(\)/);
});

test('focus is trapped while the panel is open', () => {
  // The page behind the panel is still there. Without a trap, tabbing onward lands on
  // content the reader cannot see.
  assert.match(source, /panelRef\.current/);
  assert.match(source, /querySelectorAll<HTMLElement>\(/);
  assert.match(source, /event\.key !== 'Tab'\) return/, 'only Tab is intercepted');
  assert.match(source, /launcherRef\.current\?\.focus\(\)/, 'focus is restored to the launcher');
});

test('the timings line is styled distinctly from the prose around it', () => {
  // A measured figure next to an explanation reads as part of it unless it is set
  // apart. Tabular numerals keep the line from shifting between turns.
  assert.match(source, /styles\.brainTimings/);
  assert.match(stylesheet, /\.brainTimings \{/);
  assert.match(stylesheet, /font-variant-numeric: tabular-nums/);
});

/* ------------------------------------------------- action execution in the UI */

test('the widget renders card destinations from the engine plan, not from the card', () => {
  // The point of Phase 8. Before this, every card rendered `card.href` unconditionally,
  // so a card for the page the reader was already on navigated them to the top of the
  // page they were reading.
  assert.match(source, /plan\.action\.kind === 'anchor' \? plan\.action\.href : card\.href/);
  assert.doesNotMatch(
    source,
    /<Link className=\{styles\.card\} href=\{card\.href\}>/,
    'the bare card href must not be the render path',
  );
});

test('a card the engine will not plan is omitted, not rendered dead', () => {
  // Every card currently uses `navigate`, so this branch is unreachable today. It is
  // here because widening the action kinds is the obvious next step, and a dead link
  // would be the failure mode.
  assert.match(source, /plan\.action\.kind === 'none'\) return null/);
});

test('the route comes from usePathname, so a back-button navigation is seen', () => {
  // `window.location` would need a subscription and would miss the back button. This
  // is a React value precisely so the plan recomputes on any route change.
  assert.match(source, /import \{ usePathname \} from 'next\/navigation'/);
  assert.match(source, /const pathname = usePathname\(\)/);
  // Comments may name `window.location` to explain why it is avoided, so the check is
  // against code only.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.doesNotMatch(code, /window\.location/, 'the widget must not read location directly');
});

test('the card plan effect depends on the route, not on the turn list only', () => {
  // The plan is route-dependent by construction. An effect keyed only on `turns` would
  // silently serve stale "already on this page" links after the reader navigated.
  assert.match(source, /\}, \[pathname, state\.status, turns\]\);/);
});

test('the routing effect returns no cleanup function', () => {
  // The bug this component shipped once: an effect that returns a cleanup and also
  // sets state in its own dependency list tears down its own work. `setCardPlans`
  // changes `cardPlans`, not a listed dependency, but the pattern is worth pinning
  // because it recurred twice on this codebase.
  const effectBodies = source.match(/useEffect\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/g) ?? [];
  for (const body of effectBodies) {
    assert.doesNotMatch(
      body,
      /return\s*\(\)\s*=>/,
      'an effect that sets state in its own dependency list must not return a cleanup',
    );
  }
  assert.ok(effectBodies.length >= 4, `expected the widget's effects, saw ${effectBodies.length}`);
});

test('a compare offer renders the note saying it replaces the page', () => {
  // `planAction` turns a `compare` proposal into an offer whose whole point is the
  // consequence the reader cannot see from the link text: opening it leaves the page
  // they were reading. The plan carries that note and the turn has to render it, or
  // the offer is a link that quietly throws away their place.
  assert.match(source, /const compareNote = /);
  assert.match(source, /plan\.action\.kind === 'offer' && plan\.action\.note\.length > 0/);
  assert.match(source, /\{compareNote \? <p className=\{styles\.caveatNote\}>\{compareNote\}<\/p> : null\}/);

  // Once per turn, not once per card. Five cards each repeating the same warning reads
  // as five separate problems rather than one.
  assert.equal(source.split('{compareNote ?').length - 1, 1);
});

test('the offer note text lives in planAction, not in the template', () => {
  // The consequence an offer carries is decided by `planAction`, which is the only
  // place that knows what the action does. If the wording were written out here it
  // would be a second source of truth, and it would survive a change to `planAction`
  // as a string that no longer describes what the link does.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.doesNotMatch(code, /Opening the other record|will replace this page/);
});

test('a superseded chat load cannot write state, and its pipeline is released', () => {
  // The reader can click "Try again" while a 483 MB download is still in flight. A
  // per-invocation `let current = true` is only cleared by its own cleanup, so both
  // attempts stay live and whichever resolves last wins — leaving the panel reporting
  // the timings of a load whose pipeline it discarded.
  assert.match(source, /const chatAttempt = useRef\(0\)/);
  assert.match(source, /const attempt = \(chatAttempt\.current \+= 1\)/);

  // Every write path is gated, including the one that stores the pipeline.
  const gated = source.match(/chatAttempt\.current !== attempt/g) ?? [];
  assert.equal(
    gated.length,
    3,
    'progress, success and failure must each check the attempt is still current',
  );

  // The abandoned attempt holds a real pipeline. Dropping it on the floor would leave
  // hundreds of megabytes resident for the life of the tab.
  assert.match(source, /conversation\?\.dispose\(\)/);
});

test('closing the panel claims the chat slot, so a load in flight cannot revive it', () => {
  assert.match(source, /const closeAndRelease = useCallback\(\(\) => \{[\s\S]*?chatAttempt\.current \+= 1;/);
});
