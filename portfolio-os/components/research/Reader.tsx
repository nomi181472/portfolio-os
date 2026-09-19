'use client';

/**
 * components/research/Reader.tsx
 *
 * Research is treated as a notebook, not a blog (§28, §29). That means the
 * reading surface has to carry the apparatus real technical writing needs:
 * headings you can jump between, maths, code, tables, and a visible sense of
 * how much is left.
 *
 * The progress indicator is a hairline, not a bar. It answers "how far in am
 * I" without competing with the text for attention.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { slugify, type Heading } from '@/lib/headings';
import styles from './Reader.module.css';

export type { Heading };

export function Reader({ markdown, headings }: { markdown: string; headings: Heading[] }) {
  const articleRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string | undefined>(headings[0]?.id);

  useEffect(() => {
    const onScroll = () => {
      const element = articleRef.current;
      if (!element) return;
      const start = element.offsetTop;
      const total = element.scrollHeight - window.innerHeight * 0.4;
      const seen = window.scrollY - start;
      setProgress(Math.min(1, Math.max(0, seen / Math.max(1, total))));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [headings]);

  const components = useMemo(
    () => ({
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 id={slugify(String(children))}>{children}</h2>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 id={slugify(String(children))}>{children}</h3>
      ),
      table: ({ children }: { children?: React.ReactNode }) => (
        <div className="table-scroll"><table>{children}</table></div>
      ),
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
        <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{children}</a>
      ),
    }),
    [],
  );

  return (
    <div className={styles.layout}>
      {headings.length > 1 ? (
        <nav className={styles.contents} aria-label="Contents">
          <p className="label" style={{ color: 'var(--ink-faint)' }}>Contents</p>
          <div className={styles.progress} aria-hidden="true">
            <span style={{ transform: `scaleY(${progress})` }} />
          </div>
          <ol>
            {headings.map((heading) => (
              <li key={heading.id} data-level={heading.level}>
                <a href={`#${heading.id}`} data-active={activeId === heading.id}>{heading.text}</a>
              </li>
            ))}
          </ol>
          <p className="meta" style={{ marginTop: 'var(--space-snug)' }}>{Math.round(progress * 100)}% read</p>
        </nav>
      ) : null}

      <div className="reader" ref={articleRef}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeHighlight]}
          components={components}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
