'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './CopyHub.module.css';

interface CopyHubProps {
  rawJson: string;
}

const MINIMAL_STARTER = JSON.stringify(
  {
    schemaVersion: '1.0',
    exampleContent: false,
    profile: {
      name: 'Your Name',
      discipline: 'Software Engineering & Systems Architecture',
      positioning: 'A short summary of what you build, how you think, and what you care about.',
      location: 'City, Country',
      email: 'you@example.com',
      briefing: {
        focus: 'High-impact production systems',
        yearsActive: 5,
        domains: ['Frontend', 'Backend', 'Distributed Systems', 'Cloud'],
        philosophy: 'Write down the failure modes and operating bounds before writing code.',
        specialisation: 'Full-stack architectures and resilient edge services.',
        leadership: 'Lead by tackling the hardest architectural interfaces and documenting them thoroughly.',
        industries: ['Enterprise Software', 'Logistics', 'AI']
      },
      links: [
        { label: 'GitHub', url: 'https://github.com/your-username', type: 'repository' },
        { label: 'LinkedIn', url: 'https://linkedin.com/in/your-profile', type: 'website' }
      ]
    },
    products: [
      {
        id: 'my-product',
        slug: 'my-product',
        name: 'My Flagship Product',
        tagline: 'A one-line description of the product.',
        summary: 'Summary of what it achieves for users.',
        description: 'Detailed explanation of the technical problem, why it exists, and how this solves it.',
        status: 'live',
        featured: true,
        category: 'Web Application',
        technologies: ['TypeScript', 'Next.js', 'PostgreSQL'],
        period: { startDate: '2024-01', ongoing: true },
        features: [
          { name: 'Core capability', detail: 'Specific technical detail of this feature.' }
        ],
        metrics: [
          { label: 'Daily active users', value: '10k+' }
        ],
        media: [
          {
            type: 'iframe',
            url: 'https://example.com/demo',
            title: 'Interactive Demo',
            caption: 'Live embedded preview. Replace with your live URL.',
            ratio: 1.777,
            order: 0,
            visibility: 'public'
          }
        ],
        links: [
          { label: 'Live Website', url: 'https://example.com', type: 'website' }
        ],
        relatedSkills: ['typescript', 'fullstack']
      }
    ],
    projects: [],
    research: [],
    experience: [
      {
        id: 'current-role',
        slug: 'current-role',
        name: 'Lead Software Engineer',
        organisation: 'Tech Company',
        summary: 'Led architecture of core systems.',
        period: { startDate: '2023-01', ongoing: true },
        featured: true,
        technologies: ['TypeScript', 'React', 'Node.js'],
        responsibilities: [
          'Architected core services',
          'Mentored team of engineers'
        ]
      }
    ],
    skills: [
      {
        id: 'typescript',
        slug: 'typescript',
        name: 'TypeScript',
        category: 'language',
        depth: 'applied',
        summary: 'End-to-end typed applications.'
      },
      {
        id: 'fullstack',
        slug: 'fullstack',
        name: 'Full-Stack Development',
        category: 'domain',
        depth: 'applied',
        summary: 'Building complete, data-driven web applications.'
      }
    ],
    publications: [],
    education: [],
    awards: [],
    certifications: [],
    leadership: [],
    volunteering: [],
    languages: []
  },
  null,
  2
);

const CONFIG_SAMPLE = `export const portfolioConfig = {
  site: {
    url: 'https://yourdomain.com',
    title: 'Your Name — Portfolio OS',
    description: 'Data-driven personal technology portfolio.',
    locale: 'en',
  },
  dataSource: { type: 'local' }, // or { type: 'remote', url: 'https://raw.githubusercontent.com/...' }
  theme: {
    primary: 'oklch(0.205 0.034 218)',   // Main background ink tone
    secondary: 'oklch(0.765 0.108 78)',  // Brass highlight & active state
    defaultAppearance: 'dark',
  },
  features: {
    editMode: true,
    search: true,
    graph: true,
    exampleNotice: false,
  },
  navigation: {
    primary: ['products', 'projects', 'research', 'experience', 'skills'],
    secondary: ['publications', 'education', 'leadership', 'awards', 'certifications'],
  },
};`;

type Tab = 'json' | 'starter' | 'quickstart' | 'config' | 'deploy';

export function CopyHub({ rawJson }: CopyHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>('json');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  const downloadJson = (content: string, filename = 'portfolio.json') => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineCount = rawJson.split('\n').length;
  const filteredJson = searchFilter
    ? rawJson
        .split('\n')
        .filter((l) => l.toLowerCase().includes(searchFilter.toLowerCase()))
        .join('\n')
    : rawJson;

  return (
    <div className={styles.hub}>
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statVal}>100%</span>
          <span className={styles.statLabel}>Data-Driven</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statVal}>v1.0</span>
          <span className={styles.statLabel}>Zod Schema</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statVal}>{lineCount}</span>
          <span className={styles.statLabel}>Lines in portfolio.json</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statVal}>Zero</span>
          <span className={styles.statLabel}>Code Edits Needed</span>
        </div>
      </div>

      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          className={styles.tab}
          data-active={activeTab === 'json'}
          onClick={() => setActiveTab('json')}
        >
          📋 Copy portfolio.json
        </button>
        <button
          type="button"
          role="tab"
          className={styles.tab}
          data-active={activeTab === 'starter'}
          onClick={() => setActiveTab('starter')}
        >
          🧩 Clean Starter Template
        </button>
        <button
          type="button"
          role="tab"
          className={styles.tab}
          data-active={activeTab === 'quickstart'}
          onClick={() => setActiveTab('quickstart')}
        >
          ⚡ Quickstart (Clone & Run)
        </button>
        <button
          type="button"
          role="tab"
          className={styles.tab}
          data-active={activeTab === 'config'}
          onClick={() => setActiveTab('config')}
        >
          ⚙️ Config & Theme
        </button>
        <button
          type="button"
          role="tab"
          className={styles.tab}
          data-active={activeTab === 'deploy'}
          onClick={() => setActiveTab('deploy')}
        >
          🚀 1-Click Deploy
        </button>
      </div>

      {activeTab === 'json' && (
        <div className={styles.panel}>
          <div className={styles.actionsRow}>
            <button
              type="button"
              className="control"
              data-emphasis="signal"
              onClick={() => copyToClipboard(rawJson, 'json')}
            >
              {copiedKey === 'json' ? '✓ Copied to clipboard!' : 'Copy Entire portfolio.json'}
            </button>
            <button
              type="button"
              className="control"
              onClick={() => downloadJson(rawJson, 'portfolio.json')}
            >
              Download portfolio.json
            </button>
            <Link href="/edit" className="control">
              Open Visual Editor
            </Link>
            {copiedKey === 'json' ? (
              <span className={styles.copySuccess}>✓ All {lineCount} lines copied!</span>
            ) : null}
          </div>

          <div className={styles.codeBox}>
            <div className={styles.codeHeader}>
              <span>content/portfolio.json ({lineCount} lines)</span>
              <input
                type="text"
                placeholder="Filter keys or text..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--rule)',
                  color: 'var(--ink)',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>
            <pre className={styles.codePre}>
              <code>{filteredJson}</code>
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'starter' && (
        <div className={styles.panel}>
          <p className="prose">
            A minimal, 100% schema-valid template without all the example records.
            Copy this and paste into <code>content/portfolio.json</code> to start filling in your own data:
          </p>

          <div className={styles.actionsRow}>
            <button
              type="button"
              className="control"
              data-emphasis="signal"
              onClick={() => copyToClipboard(MINIMAL_STARTER, 'starter')}
            >
              {copiedKey === 'starter' ? '✓ Copied Starter Template!' : 'Copy Starter Skeleton'}
            </button>
            <button
              type="button"
              className="control"
              onClick={() => downloadJson(MINIMAL_STARTER, 'portfolio.starter.json')}
            >
              Download Skeleton
            </button>
          </div>

          <div className={styles.codeBox}>
            <div className={styles.codeHeader}>
              <span>portfolio.starter.json (Minimal Valid Schema)</span>
            </div>
            <pre className={styles.codePre}>
              <code>{MINIMAL_STARTER}</code>
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'quickstart' && (
        <div className={styles.panel}>
          <ul className={styles.stepsList}>
            <li className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>01 // Clone Repository</span>
                <button
                  type="button"
                  className="control"
                  style={{ fontSize: '11px' }}
                  onClick={() =>
                    copyToClipboard(
                      'git clone https://github.com/noman/noman-portfolio.git my-portfolio',
                      'cmd1'
                    )
                  }
                >
                  {copiedKey === 'cmd1' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className={styles.commandBox}>
                <code>git clone https://github.com/noman/noman-portfolio.git my-portfolio</code>
              </div>
            </li>

            <li className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>02 // Install & Run Locally</span>
                <button
                  type="button"
                  className="control"
                  style={{ fontSize: '11px' }}
                  onClick={() =>
                    copyToClipboard(
                      'cd my-portfolio/portfolio-os && npm install && npm run dev',
                      'cmd2'
                    )
                  }
                >
                  {copiedKey === 'cmd2' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className={styles.commandBox}>
                <code>cd my-portfolio/portfolio-os && npm install && npm run dev</code>
              </div>
            </li>

            <li className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>03 // Replace Content</span>
              </div>
              <p className="prose">
                Edit <code>content/portfolio.json</code> directly, or navigate to{' '}
                <Link href="/edit" className="link">
                  http://localhost:3000/edit
                </Link>{' '}
                to use the built-in browser visual draft editor with live previews, undo, and export.
              </p>
            </li>

            <li className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>04 // Build & Verify</span>
                <button
                  type="button"
                  className="control"
                  style={{ fontSize: '11px' }}
                  onClick={() =>
                    copyToClipboard('npm run validate && npm run build', 'cmd3')
                  }
                >
                  {copiedKey === 'cmd3' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className={styles.commandBox}>
                <code>npm run validate && npm run build</code>
              </div>
            </li>
          </ul>
        </div>
      )}

      {activeTab === 'config' && (
        <div className={styles.panel}>
          <p className="prose">
            The site uses a strict two-colour palette system declared in{' '}
            <code>config/portfolio.config.ts</code>. Changing these two values re-skins the entire
            portfolio coherently using OKLCH color math.
          </p>

          <div className={styles.actionsRow}>
            <button
              type="button"
              className="control"
              data-emphasis="signal"
              onClick={() => copyToClipboard(CONFIG_SAMPLE, 'config')}
            >
              {copiedKey === 'config' ? '✓ Copied Config!' : 'Copy portfolio.config.ts'}
            </button>
          </div>

          <div className={styles.codeBox}>
            <div className={styles.codeHeader}>
              <span>config/portfolio.config.ts</span>
            </div>
            <pre className={styles.codePre}>
              <code>{CONFIG_SAMPLE}</code>
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'deploy' && (
        <div className={styles.panel}>
          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNumber}>Deploy on Vercel</span>
              <button
                type="button"
                className="control"
                style={{ fontSize: '11px' }}
                onClick={() => copyToClipboard('npx vercel', 'deploy-v')}
              >
                {copiedKey === 'deploy-v' ? 'Copied!' : 'Copy Command'}
              </button>
            </div>
            <p className="prose">
              Push to GitHub and import the repo on Vercel (Root Directory: <code>portfolio-os</code>), or run:
            </p>
            <div className={styles.commandBox}>
              <code>npx vercel</code>
            </div>
          </div>

          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNumber}>Deploy on Netlify / Docker</span>
            </div>
            <p className="prose">
              Because Portfolio OS uses static generation for all entity pages, it can run as a Docker container, Node.js server, or static export.
            </p>
            <div className={styles.commandBox}>
              <code>npm run build && npm run start</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
