'use client';

/**
 * components/search/CommandMenu.tsx
 *
 * Retrieval, not a site search box (§38, §109). Results always state their
 * type, because the same word usually exists as several kinds of thing, and
 * knowing which one you found is most of the answer.
 *
 * Commands live in the same list as content. Going to Research and exporting
 * your JSON are both things you might want at the moment you open this.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { search, type SearchRecord } from '@/lib/search';
import { CATEGORIES, CATEGORY_LIST } from '@/lib/categories';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import styles from './CommandMenu.module.css';

interface Command { label: string; hint: string; run: (router: ReturnType<typeof useRouter>) => void }

const COMMANDS: Command[] = [
  ...CATEGORY_LIST.map((category) => ({
    label: `Go to ${category.label}`,
    hint: category.metaphor,
    run: (router: ReturnType<typeof useRouter>) => router.push(`/${category.kind}`),
  })),
  { label: 'Go to Trajectory', hint: 'Where the work is heading', run: (r) => r.push('/future') },
  { label: 'Explore by question', hint: 'Start from what you want to know', run: (r) => r.push('/explore') },
  { label: 'Edit this portfolio', hint: 'Local draft editing, export to JSON', run: (r) => r.push('/edit') },
];

export function CommandMenu({ index, open, onClose }: { index: SearchRecord[]; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => search(index, query), [index, query]);
  const commands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS.slice(0, 4);
    return COMMANDS.filter((command) => command.label.toLowerCase().includes(q)).slice(0, 4);
  }, [query]);

  const total = results.length + commands.length;

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'ArrowDown') { event.preventDefault(); setActive((v) => (v + 1) % Math.max(1, total)); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActive((v) => (v - 1 + Math.max(1, total)) % Math.max(1, total)); }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (active < results.length) {
          const record = results[active];
          if (record) { router.push(record.href); onClose(); }
        } else {
          const command = commands[active - results.length];
          if (command) { command.run(router); onClose(); }
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, active, total, results, commands, router, onClose]);

  if (!open) return null;

  return (
    <div className={styles.scrim} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Find anything" ref={dialogRef}>
        <div className={styles.inputRow}>
          <MetaphorMark name="instrument" size={18} />
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0); }}
            placeholder="Search products, research, skills, experience…"
            aria-label="Search"
            aria-controls="command-results"
            autoComplete="off"
          />
          <kbd className="meta">esc</kbd>
        </div>

        <ul className={styles.results} id="command-results" role="listbox">
          {results.map((record, position) => {
            const category = CATEGORIES[record.kind];
            return (
              <li key={`${record.kind}:${record.id}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active === position}
                  className={styles.result}
                  data-active={active === position}
                  onMouseEnter={() => setActive(position)}
                  onClick={() => { router.push(record.href); onClose(); }}
                >
                  <MetaphorMark name={category.mark} size={16} />
                  <span className={styles.resultBody}>
                    <span className={styles.resultName}>{record.name}</span>
                    {record.summary ? <span className={styles.resultSummary}>{record.summary}</span> : null}
                  </span>
                  <span className="meta">{category.singular}</span>
                </button>
              </li>
            );
          })}

          {commands.map((command, offset) => {
            const position = results.length + offset;
            return (
              <li key={command.label}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active === position}
                  className={styles.result}
                  data-active={active === position}
                  data-kind="command"
                  onMouseEnter={() => setActive(position)}
                  onClick={() => { command.run(router); onClose(); }}
                >
                  <span className={styles.commandMark} aria-hidden="true" />
                  <span className={styles.resultBody}>
                    <span className={styles.resultName}>{command.label}</span>
                    <span className={styles.resultSummary}>{command.hint}</span>
                  </span>
                  <span className="meta">Action</span>
                </button>
              </li>
            );
          })}

          {query && total === 0 ? (
            <li className={styles.empty}>
              Nothing matches “{query}”. Try a technology, a company, or a research state such as “hypothesis”.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
