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
      name: 'Noman Ali',
      discipline: 'Solutions Architecture & Distributed Systems',
      positioning: 'Software Engineer with 5+ years of experience designing and engineering high-throughput, low-latency distributed systems using polyglot microservices (Go, C#, Python) and cloud-native Kubernetes platforms.',
      location: 'Karachi, Pakistan',
      email: 'nomansoomro51@gmail.com',
      briefing: {
        focus: 'Designing and engineering high-throughput, low-latency distributed systems, polyglot microservices, and cloud-native platforms.',
        yearsActive: 5,
        domains: ['Distributed Systems Architecture', 'Cloud & Container Platforms', 'Computer Vision & Deep Learning', 'Enterprise Security & IAM'],
        philosophy: 'Resilient systems prioritize clear service boundaries, predictable failure modes, end-to-end telemetry, and rigorous security boundaries.',
        specialisation: 'Solutions Architecture, .NET Core, Go, Python, Kubernetes EKS, SAML 2.0 / OIDC, and multi-tenant AI tracking pipelines.',
        leadership: 'Technical leadership across multi-tenant SaaS, cross-functional squads, microservice standardization, and modern cloud migrations.',
        industries: ['Enterprise SaaS', 'Computer Vision & AI', 'Securities & Fintech', 'Retail AI Auditing']
      },
      links: [
        { label: 'LinkedIn Profile', url: 'https://www.linkedin.com/in/noman-a-70604a175', type: 'contact' },
        { label: 'GitHub Profile', url: 'https://github.com/noman-ali', type: 'repository' },
        { label: 'Google Scholar', url: 'https://scholar.google.com/citations?user=SFLfK9oAAAAJ&hl=en', type: 'website' },
        { label: 'Direct Email', url: 'mailto:nomansoomro51@gmail.com', type: 'contact' }
      ]
    },
    products: [
      {
        id: 'prod-verseye',
        slug: 'verseye',
        name: 'VERSEYE',
        tagline: 'Production-Grade Computer Vision & Multi-Tenant Video AI Platform',
        summary: 'Architected high-throughput AI computer vision pipeline ingesting 100+ camera streams in real-time.',
        description: 'Engineered an end-to-end distributed video analytics architecture utilizing deep neural networks for real-time tracking, edge inference, and event notification.',
        status: 'live',
        featured: true,
        category: 'Computer Vision & AI Platform',
        technologies: ['Python', 'PyTorch', 'TensorRT', 'FastAPI', 'Redis', 'Docker', 'Kafka'],
        period: { startDate: '2021-11', ongoing: true },
        features: [
          { name: 'Multi-Camera Tracking', detail: 'Real-time multi-target multi-camera video inference with low-latency event emission.' }
        ],
        metrics: [
          { label: 'Tracking Uptime', value: '99.7%' },
          { label: 'Pipeline Latency', value: '<45ms' }
        ],
        media: [],
        links: [],
        relatedSkills: ['sk-python', 'sk-redis', 'sk-docker']
      }
    ],
    projects: [
      {
        id: 'proj-planogram-pipeline',
        slug: 'retail-planogram-audit-pipeline',
        name: 'Retail Planogram Audit Pipeline',
        category: 'Applied AI & Computer Vision',
        summary: 'Multimodal agentic computer vision pipeline combining object detection, SKU recognition, and LLM reasoning for retail compliance.',
        technologies: ['Python', 'PyTorch', 'LangChain', 'FastAPI', 'Docker'],
        period: { startDate: '2024-01', ongoing: true },
        featured: true
      }
    ],
    research: [],
    experience: [
      {
        id: 'exp-qbs',
        slug: 'qbs-co',
        name: 'Lead Software Engineer / Solutions Architect',
        organisation: 'QBS Co.',
        summary: 'Architecting polyglot microservices (Go, C#, Python) and enterprise identity platforms on Kubernetes.',
        period: { startDate: '2024-02', ongoing: true },
        featured: true,
        technologies: ['Go', 'C#', '.NET Core', 'Kubernetes', 'PostgreSQL', 'Redis']
      }
    ],
    skills: [
      {
        id: 'sk-python',
        slug: 'python',
        name: 'Python',
        category: 'Programming Languages',
        depth: 'specialist',
        summary: 'Core language for deep learning architectures, asynchronous web microservices, and CV pipelines.'
      },
      {
        id: 'sk-csharp',
        slug: 'csharp',
        name: 'C#',
        category: 'Programming Languages',
        depth: 'specialist',
        summary: 'High-throughput enterprise services, distributed API gateways, and IAM infrastructure.'
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
    url: 'https://nomanali.online',
    title: 'Noman Ali — Solutions Architecture & Distributed Systems',
    description: 'Software Engineer & Solutions Architect with 5+ years of experience engineering high-throughput, low-latency distributed systems, polyglot microservices, and cloud-native platforms.',
    locale: 'en',
  },
  dataSource: { type: 'local' }, // or { type: 'remote', url: 'https://raw.githubusercontent.com/nomi181472/portfolio-os/main/content/portfolio.json' }
  theme: {
    primary: 'oklch(0.12 0.005 260)',   // Obsidian substrate (deep architectural black)
    secondary: 'oklch(0.98 0.002 260)',  // Crisp Silver / Luminescent White signal
    defaultAppearance: 'dark',
  },
  features: {
    editMode: true,
    search: true,
    graph: true,
    analytics: true,
    exampleNotice: false,
  },
  navigation: {
    primary: ['experience', 'products', 'projects', 'startup', 'research', 'skills', 'awards'],
    secondary: ['publications', 'education', 'leadership', 'certifications', 'volunteering', 'languages'],
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
                      'git clone https://github.com/nomi181472/portfolio-os.git my-portfolio',
                      'cmd1'
                    )
                  }
                >
                  {copiedKey === 'cmd1' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className={styles.commandBox}>
                <code>git clone https://github.com/nomi181472/portfolio-os.git my-portfolio</code>
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
