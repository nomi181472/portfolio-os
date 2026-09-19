'use client';

/**
 * An unobtrusive entry point (§48, §55). It states one thing — whether you are
 * looking at published content or your own draft — and gets out of the way.
 */
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOptionalEditor } from './store';
import styles from './EditBar.module.css';

export function EditBar() {
  const editor = useOptionalEditor();
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        router.push('/edit');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const count = editor?.changes.length ?? 0;

  return (
    <div className={styles.bar}>
      {count > 0 ? (
        <span className={styles.state} data-dirty="true">
          {count === 1 ? '1 unsaved change' : `${count} unsaved changes`}
        </span>
      ) : null}
      <Link href="/edit" className={styles.link} aria-keyshortcuts="Meta+E Control+E">Edit</Link>
    </div>
  );
}
