'use client';

/**
 * components/editor/Workbench.tsx
 *
 * The editor keeps the site's visual language rather than becoming an admin
 * panel (§47). Same rail, same rules, same type. You are editing the artifact,
 * not filling in a form about it.
 *
 * Fields are generated from the shape of the data rather than hand-written per
 * category, which is what keeps "add a new category" from also meaning "write a
 * new editor".
 */

import { useMemo, useRef, useState } from 'react';
import { useEditor } from './store';
import { CATEGORY_LIST, CATEGORIES } from '@/lib/categories';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { exportPortfolio, importPortfolio, downloadJson } from '@/lib/transfer';
import { safeUrl } from '@/lib/schema';
import type { EntityKind } from '@/types/portfolio';
import styles from './Workbench.module.css';

type Loose = Record<string, unknown>;

/** Fields shown by default. Everything else is behind "all fields". */
const HEADLINE_FIELDS = ['name', 'summary', 'tagline', 'description', 'status', 'role', 'organisation', 'institution', 'issuer'];

function isPlainObject(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function Workbench() {
  const editor = useEditor();
  const [kind, setKind] = useState<EntityKind>('products');
  const [selected, setSelected] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [panel, setPanel] = useState<'fields' | 'changes' | 'transfer'>('fields');
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'problem'; text: string } | null>(null);

  const collection = (editor.draft[kind] ?? []) as Loose[];
  const entity = collection[selected];
  const basePath = `${kind}.${selected}`;

  const fields = useMemo(() => {
    if (!entity) return [] as [string, unknown][];
    const entries = Object.entries(entity).filter(([key]) => key !== 'id');
    if (showAll) return entries;
    return entries.filter(([key]) => HEADLINE_FIELDS.includes(key) || key === 'links' || key === 'technologies');
  }, [entity, showAll]);

  /* ----------------------------------------------------------- operations */

  const mutateCollection = (next: Loose[]) => editor.setPath(kind, next);

  const addEntity = () => {
    const next = [...collection, {
      id: `new-${Date.now().toString(36)}`,
      slug: `new-${CATEGORIES[kind].kind}-${collection.length + 1}`,
      name: `New ${CATEGORIES[kind].singular.toLowerCase()}`,
      summary: '',
      tags: [], technologies: [], links: [], media: [], evidence: [], timeline: [],
      relatedSkills: [], relatedProducts: [], relatedProjects: [], relatedResearch: [],
      relatedPublications: [], relatedExperience: [], relatedEducation: [],
      featured: false,
    }];
    mutateCollection(next);
    setSelected(next.length - 1);
  };

  const duplicateEntity = () => {
    if (!entity) return;
    const copy = structuredClone(entity);
    copy.id = `${String(copy.id)}-copy-${Date.now().toString(36)}`;
    copy.slug = `${String(copy.slug)}-copy`;
    copy.name = `${String(copy.name)} (copy)`;
    const next = [...collection];
    next.splice(selected + 1, 0, copy);
    mutateCollection(next);
    setSelected(selected + 1);
  };

  const deleteEntity = () => {
    if (!entity) return;
    const next = collection.filter((_, index) => index !== selected);
    mutateCollection(next);
    setSelected(Math.max(0, selected - 1));
  };

  const move = (direction: -1 | 1) => {
    const target = selected + direction;
    if (target < 0 || target >= collection.length) return;
    const next = [...collection];
    const [item] = next.splice(selected, 1);
    next.splice(target, 0, item as Loose);
    mutateCollection(next);
    setSelected(target);
  };

  const onExport = () => {
    const result = exportPortfolio(editor.draft);
    if (!result.ok) {
      setMessage({ tone: 'problem', text: `Export blocked. ${result.issues.length} field(s) need fixing:\n\n${result.report}` });
      setPanel('changes');
      return;
    }
    downloadJson(result.json, result.filename);
    setMessage({ tone: 'ok', text: 'portfolio.json downloaded. Commit it to your data repository and the site will pick it up.' });
  };

  const onCopy = async () => {
    const result = exportPortfolio(editor.draft);
    if (!result.ok) { setMessage({ tone: 'problem', text: result.report }); return; }
    await navigator.clipboard.writeText(result.json);
    setMessage({ tone: 'ok', text: 'JSON copied to the clipboard.' });
  };

  const onImport = async (file: File) => {
    const result = importPortfolio(await file.text());
    if (!result.ok) {
      setMessage({ tone: 'problem', text: `This file was not applied.\n\n${result.report}` });
      return;
    }
    editor.replace(result.data);
    setSelected(0);
    setMessage({
      tone: 'ok',
      text: result.warnings.length
        ? `Imported, with notes:\n\n${result.warnings.join('\n')}`
        : 'Imported. You are now previewing the file you chose.',
    });
  };

  /* --------------------------------------------------------------- render */

  return (
    <div className={styles.workbench}>
      <aside className={styles.sidebar}>
        <label className="label" htmlFor="collection">Collection</label>
        <select
          id="collection"
          className="field"
          value={kind}
          onChange={(event) => { setKind(event.target.value as EntityKind); setSelected(0); }}
        >
          {CATEGORY_LIST.map((category) => (
            <option key={category.kind} value={category.kind}>
              {category.label} ({((editor.draft[category.kind] ?? []) as unknown[]).length})
            </option>
          ))}
        </select>

        <ul className={styles.entityList}>
          {collection.map((item, index) => (
            <li key={String(item.id ?? index)}>
              <button
                type="button"
                className={styles.entityItem}
                data-active={index === selected}
                onClick={() => setSelected(index)}
              >
                <MetaphorMark name={CATEGORIES[kind].mark} size={14} />
                <span>{String(item.name ?? 'Untitled')}</span>
              </button>
            </li>
          ))}
          {collection.length === 0 ? <li className="label">Nothing in this collection yet.</li> : null}
        </ul>

        <div className={styles.ops}>
          <button type="button" className="control" onClick={addEntity}>Add</button>
          <button type="button" className="control" onClick={duplicateEntity} disabled={!entity}>Duplicate</button>
          <button type="button" className="control" onClick={() => move(-1)} disabled={selected === 0}>Move up</button>
          <button type="button" className="control" onClick={() => move(1)} disabled={selected >= collection.length - 1}>Move down</button>
          <button type="button" className="control" onClick={deleteEntity} disabled={!entity} data-emphasis="signal">Delete</button>
        </div>
      </aside>

      <div className={styles.main}>
        <nav className={styles.tabs} aria-label="Editor panels">
          {(['fields', 'changes', 'transfer'] as const).map((tab) => (
            <button key={tab} type="button" className={styles.tab} data-active={panel === tab} onClick={() => setPanel(tab)}>
              {tab === 'fields' ? 'Fields' : tab === 'changes' ? `Changes (${editor.changes.length})` : 'Import & export'}
            </button>
          ))}
          <span className={styles.spacer} />
          <button type="button" className="control" onClick={editor.undo} disabled={!editor.canUndo}>Undo</button>
          <button type="button" className="control" onClick={editor.redo} disabled={!editor.canRedo}>Redo</button>
        </nav>

        {message ? (
          <p className="notice" style={{ whiteSpace: 'pre-wrap', borderLeftColor: message.tone === 'problem' ? 'var(--signal)' : 'var(--signal-quiet)' }}>
            {message.text}
          </p>
        ) : null}

        {panel === 'fields' ? (
          entity ? (
            <div className={styles.fields}>
              <div className={styles.fieldsHead}>
                <h2 className="title">{String(entity.name)}</h2>
                <label className="label" style={{ display: 'flex', gap: 'var(--space-tight)', alignItems: 'center' }}>
                  <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
                  Show every field
                </label>
              </div>

              {fields.map(([key, value]) => (
                <Field
                  key={key}
                  name={key}
                  value={value}
                  path={`${basePath}.${key}`}
                  onChange={(next) => editor.setPath(`${basePath}.${key}`, next)}
                  onReset={() => editor.resetPath(`${basePath}.${key}`)}
                />
              ))}
            </div>
          ) : (
            <p className="notice">Select an entry on the left, or add one.</p>
          )
        ) : null}

        {panel === 'changes' ? <ChangesPanel /> : null}

        {panel === 'transfer' ? (
          <div className={styles.transfer}>
            <div>
              <h2 className="title">Export</h2>
              <p className="label" style={{ maxWidth: 'var(--measure)' }}>
                Validated, key-sorted and stable, so committing it produces a diff you can actually read. This file is
                the same format the site loads — there is no separate export shape.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-snug)', marginTop: 'var(--space)' }}>
                <button type="button" className="control" data-emphasis="signal" onClick={onExport}>Download portfolio.json</button>
                <button type="button" className="control" onClick={onCopy}>Copy to clipboard</button>
              </div>
            </div>

            <div>
              <h2 className="title">Import</h2>
              <p className="label" style={{ maxWidth: 'var(--measure)' }}>
                Replaces what you are previewing. Nothing is written to the repository, and invalid files are rejected
                with the exact field that needs attention.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImport(file); }}
              />
              <button type="button" className="control" style={{ marginTop: 'var(--space)' }} onClick={() => fileRef.current?.click()}>
                Choose a JSON file
              </button>
            </div>

            <div>
              <h2 className="title">Start over</h2>
              <p className="label" style={{ maxWidth: 'var(--measure)' }}>
                Discards every local change and returns to the content the site was built with. This cannot be undone.
              </p>
              <button type="button" className="control" style={{ marginTop: 'var(--space)' }} onClick={editor.resetAll} disabled={!editor.dirty}>
                Discard all changes
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- fields */

function Field({
  name, value, path, onChange, onReset,
}: { name: string; value: unknown; path: string; onChange: (next: unknown) => void; onReset: () => void }) {
  const label = name.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());

  if (typeof value === 'boolean') {
    return (
      <div className={styles.field}>
        <label className="label">
          <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /> {label}
        </label>
      </div>
    );
  }

  if (typeof value === 'number') {
    return (
      <div className={styles.field}>
        <label className="label" htmlFor={path}>{label}</label>
        <input id={path} className="field" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      </div>
    );
  }

  if (typeof value === 'string') {
    const long = value.length > 90 || name === 'description' || name === 'body' || name === 'abstract';
    const isUrl = /url$/i.test(name);
    const invalid = isUrl && value.length > 0 && !safeUrl.safeParse(value).success;
    return (
      <div className={styles.field}>
        <div className={styles.fieldHead}>
          <label className="label" htmlFor={path}>{label}</label>
          <button type="button" className={styles.reset} onClick={onReset}>Reset</button>
        </div>
        {long ? (
          <textarea id={path} className="field" rows={name === 'body' ? 14 : 4} value={value} onChange={(event) => onChange(event.target.value)} />
        ) : (
          <input id={path} className="field" value={value} data-invalid={invalid} onChange={(event) => onChange(event.target.value)} />
        )}
        {invalid ? <p className="label" style={{ color: 'var(--signal)' }}>Not a usable URL. Use https://…, mailto: or a path starting with /</p> : null}
      </div>
    );
  }

  if (Array.isArray(value)) {
    const primitive = value.every((item) => typeof item === 'string');
    if (primitive) {
      return (
        <div className={styles.field}>
          <div className={styles.fieldHead}>
            <label className="label" htmlFor={path}>{label}</label>
            <button type="button" className={styles.reset} onClick={onReset}>Reset</button>
          </div>
          <input
            id={path}
            className="field"
            value={(value as string[]).join(', ')}
            onChange={(event) => onChange(event.target.value.split(',').map((part) => part.trim()).filter(Boolean))}
          />
          <p className="label">Separate with commas.</p>
        </div>
      );
    }
    return (
      <div className={styles.field}>
        <div className={styles.fieldHead}>
          <span className="label">{label} ({value.length})</span>
          <button
            type="button"
            className={styles.reset}
            onClick={() => onChange([...(value as unknown[]), templateFor(name)])}
          >
            Add
          </button>
        </div>
        <div className={styles.nested}>
          {(value as Loose[]).map((item, index) => (
            <div key={index} className={styles.nestedItem}>
              <div className={styles.fieldHead}>
                <span className="meta">{name}[{index}]</span>
                <button
                  type="button"
                  className={styles.reset}
                  onClick={() => onChange((value as unknown[]).filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
              {Object.entries(item).map(([key, inner]) => (
                <Field
                  key={key}
                  name={key}
                  value={inner}
                  path={`${path}.${index}.${key}`}
                  onChange={(next) => {
                    const copy = structuredClone(value as Loose[]);
                    (copy[index] as Loose)[key] = next;
                    onChange(copy);
                  }}
                  onReset={onReset}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isPlainObject(value)) {
    return (
      <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">{label}</legend>
        <div className={styles.nested}>
          {Object.entries(value).map(([key, inner]) => (
            <Field
              key={key}
              name={key}
              value={inner}
              path={`${path}.${key}`}
              onChange={(next) => onChange({ ...value, [key]: next })}
              onReset={onReset}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  return null;
}

function templateFor(name: string): Loose {
  if (name === 'links') return { label: 'New link', url: 'https://', type: 'website', visibility: 'public' };
  if (name === 'media') return { type: 'image', url: 'https://', title: '', alt: '', visibility: 'public' };
  if (name === 'features') return { name: 'New capability', detail: '' };
  if (name === 'timeline') return { date: new Date().toISOString().slice(0, 10), label: '' };
  if (name === 'evidence') return { claim: '', supports: [], links: [] };
  if (name === 'findings') return { date: new Date().toISOString().slice(0, 10), observation: '', confidence: 'moderate' };
  return {};
}

/* -------------------------------------------------------------- changes */

function ChangesPanel() {
  const { changes, canonical, resetPath } = useEditor();
  if (changes.length === 0) {
    return <p className="notice">Nothing has changed. You are looking at the content exactly as it is published.</p>;
  }
  return (
    <ol className={styles.changes}>
      {changes.map((change) => (
        <li key={`${change.type}-${change.path}`} className={styles.change} data-type={change.type}>
          <div>
            <p className="meta">{change.type}</p>
            <p className={styles.changePath}>{change.path}</p>
            {change.type === 'modified' ? (
              <p className="label">
                <span style={{ color: 'var(--ink-faint)', textDecoration: 'line-through' }}>{preview(change.before)}</span>
                {' → '}
                <span style={{ color: 'var(--ink-bright)' }}>{preview(change.after)}</span>
              </p>
            ) : (
              <p className="label">{preview(change.after ?? change.before)}</p>
            )}
          </div>
          {change.type === 'modified' && readable(canonical, change.path) ? (
            <button type="button" className="control" onClick={() => resetPath(change.path.replace(/\[(\d+)\]/g, '.$1'))}>Revert</button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function readable(root: unknown, path: string): boolean {
  return path.split(/[.[\]]+/).filter(Boolean).reduce<unknown>(
    (node, key) => (node === null || node === undefined ? undefined : (node as Loose)[key]),
    root,
  ) !== undefined;
}

function preview(value: unknown): string {
  if (value === undefined) return '—';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}
