'use client';

/**
 * components/editor/store.tsx
 *
 * Edit mode is a *local draft layered over canonical content* (§52, §88). The
 * remote file is never mutated, there is no server, and nothing here pretends
 * to be authenticated. What you get is the ability to change anything, see it
 * immediately, and leave with valid JSON.
 *
 * History is kept as whole documents rather than patches. A portfolio is tens
 * of kilobytes; a hundred snapshots is a few megabytes of memory and buys an
 * undo implementation with no edge cases.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { diff, summarise, type Change } from '@/lib/diff';
import type { Portfolio } from '@/types/portfolio';

const STORAGE_KEY = 'portfolio-os:draft:v1';
const HISTORY_LIMIT = 100;

interface EditorValue {
  /** What the server rendered. The comparison point, never written to. */
  canonical: Portfolio;
  /** What you are looking at: canonical, or canonical plus your changes. */
  draft: Portfolio;
  dirty: boolean;
  changes: Change[];
  changeSummary: string;
  canUndo: boolean;
  canRedo: boolean;
  /** Set a value at a path like `products.0.links.1.url`. */
  setPath: (path: string, value: unknown) => void;
  replace: (next: Portfolio, options?: { resetHistory?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  resetPath: (path: string) => void;
  resetAll: () => void;
  /** A draft was found in storage and has not been accepted or discarded yet. */
  pendingRestore: boolean;
  acceptRestore: () => void;
  discardRestore: () => void;
}

const EditorContext = createContext<EditorValue | null>(null);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function readPath(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node === null || node === undefined) return undefined;
    return (node as Record<string, unknown>)[key];
  }, root);
}

function writePath<T>(root: T, path: string, value: unknown): T {
  const next = clone(root);
  const keys = path.split('.');
  let node = next as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]!;
    const child = node[key];
    if (child === undefined || child === null) node[key] = Number.isNaN(Number(keys[i + 1])) ? {} : [];
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]!] = value;
  return next;
}

export function EditorProvider({ canonical, children }: { canonical: Portfolio; children: React.ReactNode }) {
  const [draft, setDraft] = useState<Portfolio>(() => clone(canonical));
  const [history, setHistory] = useState<Portfolio[]>([]);
  const [future, setFuture] = useState<Portfolio[]>([]);
  const [pendingRestore, setPendingRestore] = useState(false);
  const stored = useRef<Portfolio | null>(null);

  // Offer, never impose (§89). A draft from a previous session is restored only
  // when you say so, because silently replacing what someone sees is worse than
  // losing an edit.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Portfolio;
      if (JSON.stringify(parsed) === JSON.stringify(canonical)) return;
      stored.current = parsed;
      setPendingRestore(true);
    } catch {
      /* Storage unavailable or corrupt; carry on with canonical content. */
    }
  }, [canonical]);

  const persist = useCallback((next: Portfolio) => {
    try {
      if (JSON.stringify(next) === JSON.stringify(canonical)) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* Quota or private mode. Editing still works for this session. */
    }
  }, [canonical]);

  const commit = useCallback((next: Portfolio) => {
    setHistory((past) => [...past, draft].slice(-HISTORY_LIMIT));
    setFuture([]);
    setDraft(next);
    persist(next);
  }, [draft, persist]);

  const setPath = useCallback((path: string, value: unknown) => {
    commit(writePath(draft, path, value));
  }, [commit, draft]);

  const replace = useCallback((next: Portfolio, options?: { resetHistory?: boolean }) => {
    if (options?.resetHistory) { setHistory([]); setFuture([]); setDraft(next); persist(next); return; }
    commit(next);
  }, [commit, persist]);

  const undo = useCallback(() => {
    setHistory((past) => {
      if (past.length === 0) return past;
      const previous = past[past.length - 1]!;
      setFuture((ahead) => [draft, ...ahead]);
      setDraft(previous);
      persist(previous);
      return past.slice(0, -1);
    });
  }, [draft, persist]);

  const redo = useCallback(() => {
    setFuture((ahead) => {
      if (ahead.length === 0) return ahead;
      const next = ahead[0]!;
      setHistory((past) => [...past, draft].slice(-HISTORY_LIMIT));
      setDraft(next);
      persist(next);
      return ahead.slice(1);
    });
  }, [draft, persist]);

  const resetPath = useCallback((path: string) => {
    commit(writePath(draft, path, clone(readPath(canonical, path))));
  }, [canonical, commit, draft]);

  const resetAll = useCallback(() => {
    const fresh = clone(canonical);
    setHistory((past) => [...past, draft].slice(-HISTORY_LIMIT));
    setFuture([]);
    setDraft(fresh);
    persist(fresh);
  }, [canonical, draft, persist]);

  const changes = useMemo(() => diff(canonical, draft), [canonical, draft]);

  const value: EditorValue = {
    canonical,
    draft,
    dirty: changes.length > 0,
    changes,
    changeSummary: summarise(changes),
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    setPath,
    replace,
    undo,
    redo,
    resetPath,
    resetAll,
    pendingRestore,
    acceptRestore: () => {
      if (stored.current) replace(stored.current, { resetHistory: true });
      setPendingRestore(false);
    },
    discardRestore: () => {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      stored.current = null;
      setPendingRestore(false);
    },
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorValue {
  const context = useContext(EditorContext);
  if (!context) throw new Error('useEditor must be used inside <EditorProvider>');
  return context;
}

/** Safe accessor for components that render in both view and edit contexts. */
export function useOptionalEditor(): EditorValue | null {
  return useContext(EditorContext);
}
