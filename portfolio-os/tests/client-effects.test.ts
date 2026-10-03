/**
 * tests/client-effects.test.ts
 *
 * Guards a bug that was live in two components and invisible to every other test.
 *
 * An effect that returns a cleanup function and also sets state listed in its own
 * dependency array tears down its own async work. `setX(...)` changes `x`, React
 * re-runs the effect, the cleanup marks the in-flight request cancelled, and the
 * response that had already arrived is discarded. There is no error: the request
 * goes out, nothing comes back, and the UI waits forever.
 *
 * That is not hypothetical. Both `/api/search` and `/api/agent/knowledge` were
 * fetched on open, discarded on arrival, and left their surfaces permanently
 * reading "Loading the index…" and "Reading the portfolio…". The search bug
 * predates this work and shipped; it was found by driving the site in a browser.
 *
 * Neither component can be rendered in this suite — `react-dom/server` refuses
 * under `--conditions=react-server`, and `tsx` cannot parse a CSS module import —
 * so the pattern is checked directly instead. Deliberately narrow: an effect that
 * merely sets a dependency it also lists is fine when it returns no cleanup, which
 * is the common re-register-a-listener case. Only the combination is a defect.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const COMPONENTS = ['components/agent/AgentWidget.tsx', 'components/search/CommandMenu.tsx'];

const read = (relative: string): string => readFileSync(resolve(process.cwd(), relative), 'utf8');

/** `return () => {…}` or `return function () {…}` — anything the effect hands back. */
const RETURNS_CLEANUP = /return\s*(?:\(\s*\)\s*=>|function\s*\w*\s*\([^)]*\))\s*\{/;

/**
 * The state a setter writes, from the part of its name after `set`.
 *
 * `setIndexState` writes `indexState`, not `IndexState`, so the leading capital has
 * to come back down. Getting this wrong makes every check below compare the wrong
 * identifier and pass for the wrong reason.
 */
function stateNameFor(setterTail: string): string {
  return setterTail.charAt(0).toLowerCase() + setterTail.slice(1);
}

/**
 * The source of one `useEffect` call: its body, and its dependency array.
 *
 * Found by scanning braces from the `(` of `useEffect(`, not by regex. Regex was
 * tried first and picked the wrong array twice: cutting the file at each
 * `useEffect(` and taking the last `}, [ … ])` matched the trailing array of a
 * neighbouring `useMemo(() => {…}, [query])`, so an effect's own dependencies were
 * never read and the check passed for the wrong reason.
 *
 * Strings, template literals and comments are skipped, because a `}` inside any of
 * them would otherwise close the effect early.
 */
interface Effect {
  body: string;
  deps: string;
}

function effectsOf(source: string): Effect[] {
  const effects: Effect[] = [];

  for (const match of source.matchAll(/useEffect\(/g)) {
    const open = source.indexOf('(', match.index);
    if (open === -1) continue;

    let i = open + 1;
    // Both braces and parens are counted. Tracking only braces leaves depth pinned
    // at 1 by the arrow's own braces, and the scan runs off the end of the file.
    let depth = 1;
    let bodyStart = -1;
    let bodyEnd = -1;

    while (i < source.length) {
      const c = source[i];

      if (c === '/' && source[i + 1] === '/') {
        while (i < source.length && source[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && source[i + 1] === '*') {
        i += 2;
        while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        const quote = c;
        i++;
        while (i < source.length && source[i] !== quote) {
          if (source[i] === '\\') i++;
          i++;
        }
        i++;
        continue;
      }

      if (c === '{') {
        if (depth === 1) bodyStart = i;
        depth++;
      } else if (c === '(') {
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 1) bodyEnd = i;
      } else if (c === ')') {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }

    if (bodyStart === -1 || bodyEnd === -1) continue;

    const body = source.slice(bodyStart + 1, bodyEnd);
    const after = source.slice(bodyEnd + 1);
    const found = /^\s*,\s*\[([^\]]*)\]/.exec(after);

    effects.push({ body, deps: found?.[1] ?? '' });
  }

  return effects;
}

/** True when this effect both returns a cleanup and sets state it depends on. */
function isSelfCancelling({ body, deps }: Effect): boolean {
  if (!deps.trim() || !RETURNS_CLEANUP.test(body)) return false;

  return [...body.matchAll(/\bset([A-Z]\w*)\s*\(/g)].some((match) => {
    if (!match[1]) return false;
    return new RegExp(`\\b${stateNameFor(match[1])}\\b`).test(deps);
  });
}

test('no effect cancels async work it started by setting its own dependency', () => {
  const offenders: string[] = [];

  for (const relative of COMPONENTS) {
    for (const effect of effectsOf(read(relative))) {
      if (!isSelfCancelling(effect)) continue;
      offenders.push(
        `${relative}: returns a cleanup and sets state that is also a dependency`,
      );
    }
  }

  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('the reader finds every effect and its real dependencies', () => {
  // The check above is only as good as the reader. Assert it against the real
  // file: three effects, and the fetch effect's dependencies are exactly `open`.
  const effects = effectsOf(read('components/search/CommandMenu.tsx'));

  assert.equal(effects.length, 3, 'expected the three useEffect calls in CommandMenu');
  assert.equal(effects[0]?.deps.trim(), 'open');
  // The `useMemo(() => …, [query])` between effects must not be mistaken for one.
  assert.ok(
    !effects.some((effect) => effect.deps.trim() === 'query'),
    'a dependency array belonging to a useMemo was read as an effect dependency',
  );
});

test('the guard still detects the pattern it was written for', () => {
  // A test that cannot fail is worse than no test, so prove the detector works
  // against the shape that actually shipped.
  const broken = `
    const [indexState, setIndexState] = useState('idle');
    useEffect(() => {
      if (!open || indexState !== 'idle') return;
      let cancelled = false;
      setIndexState('loading');
      fetch('/api/search').then((r) => r.json()).then((records) => {
        if (cancelled) return;
        setIndexState('ready');
      });
      return () => { cancelled = true; };
    }, [open, indexState]);
  `;

  assert.equal(effectsOf(broken).filter(isSelfCancelling).length, 1);
});

test('an effect that re-registers a listener is not flagged', () => {
  // The legitimate case: `active` is both set and depended on, but nothing is
  // cancelled, so the re-run is just a fresh listener registration.
  const fine = `
    useEffect(() => {
      const onKey = (event) => setActive((v) => v + 1);
      window.addEventListener('keydown', onKey);
      setOpen(true);
    }, [open, active]);
  `;

  assert.equal(effectsOf(fine).filter(isSelfCancelling).length, 0);
});

test('a brace inside a string or comment does not end the effect early', () => {
  const tricky = `
    useEffect(() => {
      const closing = '}';
      // } in a line comment
      setOpen(true);
    }, [open]);
  `;

  const [effect] = effectsOf(tricky);
  assert.ok(effect?.body.includes('setOpen(true)'), 'the body was cut short');
});