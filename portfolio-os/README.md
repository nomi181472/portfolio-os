<div align="center">

# Portfolio OS

[![Live Portfolio](https://img.shields.io/badge/Live_Site-www.nomanali.online-2563eb?style=for-the-badge&logo=google-chrome&logoColor=white)](https://www.nomanali.online/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15.0-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/nomi181472/portfolio-os?style=for-the-badge&color=eab308)](https://github.com/nomi181472/portfolio-os/stargazers)

<p align="center">
  <strong>The open-source Personal Operating System & Portfolio Framework for Systems Engineers, Architects, and Researchers.</strong>
</p>

<p align="center">
  <em>A content-driven architecture where work cannot fit on a single flat resume. Edit one JSON file or use the built-in browser editor. Pre-rendered, ultra-fast, and search-engine optimized.</em>
</p>

🔗 **[Explore Live Demo → www.nomanali.online](https://www.nomanali.online/)**

</div>

---

## 🧭 Overview & Target Highlights

Most developer portfolio templates are simple single-page landing sites. **Portfolio OS** is an engineering artifact: a connected **knowledge graph** that models real-world engineering depth across **16 structured collections** — with bidirectional linking, an in-browser zero-dependency visual editor, full-text fuzzy command palette search (`⌘/Ctrl + K`), and privacy-first analytics.

- **Author / Architect:** [Noman Ali](https://www.nomanali.online/) (Solutions Architecture & Distributed Systems)
- **Primary Live Deployment:** [https://www.nomanali.online](https://www.nomanali.online)
- **Repository:** [https://github.com/nomi181472/portfolio-os](https://github.com/nomi181472/portfolio-os)
- **Tech Stack:** Next.js 15 (App Router, Server Components), TypeScript, OKLCH Two-Color Token Engine, Zod, KaTeX, Schema.org JSON-LD.

---

## ✨ Key Capabilities & System Features

| Feature | Description | Search & Performance Benefit |
|---|---|---|
| 🗂️ **16 Structured Collections** | Products, projects, research, publications, skills, experience, awards, certifications, education, leadership, and startup ventures | Individual crawlable canonical URLs for every single project, publication, and skill |
| 🔗 **Bidirectional Knowledge Graph** | Cross-linked entities: skills link to products, products link to research. An interactive SVG schematic renders connections visually | Deep internal link architecture boosts Google search indexing and contextual entity ranking |
| ✏️ **Built-in Visual Editor** | Browser-based GUI with live preview, undo/redo history, JSON diff, and export (`⌘/Ctrl + E`) | Zero CMS or database required — pure static content agility |
| 🔍 **Full-Text Command Menu** | Instant `⌘/Ctrl + K` fuzzy search over all entities, summaries, and technical tags | Instant client navigation without heavy page overhead |
| 📊 **Zero-Cookie Analytics** | Self-hosted, privacy-first analytics dashboard with HyperLogLog unique visitors, scroll depth, and geographic breakdowns | Zero external tracking scripts — 100/100 Google Lighthouse performance score |
| 🎨 **OKLCH Mathematical Theming** | Dynamic styling derived from two mathematical color seeds. Supports Obsidian Dark, Warm Sepia, Paper Light, and High Contrast | Coherent visual hierarchy across dark/light modes and accessibility standards |
| ⚡ **SEO & Rich Structured Data** | Built-in Schema.org `Person`, `WebSite`, `Article`, `ScholarlyArticle`, and `ItemList` JSON-LD graphs | Instant rich snippets, Google Knowledge Graph eligibility, and social preview cards |

---

## 🚀 Quickstart — Deploy Yours in 3 Steps

### 1. Clone & Install

```bash
git clone https://github.com/nomi181472/portfolio-os.git my-portfolio
cd my-portfolio
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the system running locally.

### 2. Customize Content (`content/portfolio.json`)

Everything about your experience, achievements, and projects lives in a single validated file: **`content/portfolio.json`**.

You can edit it in two ways:

- **Method A — Visual In-Browser Editor (Recommended)**:
  1. Go to [http://localhost:3000/edit](http://localhost:3000/edit) or press `⌘/Ctrl + E`.
  2. Visually update your information, add projects, and tweak skills.
  3. Hit **Export** and replace `content/portfolio.json`.
- **Method B — Direct JSON Modification**:
  1. Open `content/portfolio.json` in your favorite IDE.
  2. Validate changes with:
     ```bash
     npm run validate
     ```

### 3. Configure Site Metadata & Deploy

Update `config/portfolio.config.ts`:

```ts
export const portfolioConfig = {
  site: {
    url: 'https://your-domain.com',       // Your canonical production domain
    title: 'Your Name — Your Discipline', // Browser title & social card header
    description: 'Concise summary for Google search results and OpenGraph snippets.',
    locale: 'en',
  },
  theme: {
    primary: 'oklch(0.12 0.005 260)',     // Substrate background
    secondary: 'oklch(0.98 0.002 260)',   // Contrast signal
    defaultAppearance: 'sepia',          // 'dark' | 'light' | 'system' | 'sepia'
  },
};
```

Deploy to [Vercel](https://vercel.com) or any cloud provider:

```bash
npm run build
npx vercel
```

---

## 🏗️ Architecture & Directory Layout

```text
portfolio-os/
├── content/
│   └── portfolio.json          # Your primary content database (single source of truth)
├── config/
│   └── portfolio.config.ts     # Domain, metadata, colors, and feature flags
├── app/                        # Next.js 15 App Router (Static pre-rendered routes)
│   ├── page.tsx                # Surface / Depth 0 home view & schematic map
│   ├── [category]/             # Category indices (/products, /research, /skills, etc.)
│   ├── [category]/[slug]/      # Pre-rendered entity detail views
│   ├── sitemap.ts              # Automated XML sitemap generation with dynamic lastmod
│   ├── robots.ts               # Automated robots.txt rules
│   ├── manifest.ts             # Web App Manifest & PWA specifications
│   ├── edit/                   # Browser-based visual editor
│   ├── analytics/              # Self-hosted private analytics dashboard
│   └── opengraph-image.tsx     # Dynamic server-side Open Graph social preview cards
├── components/                 # Reusable UI & layout modules
├── lib/                        # Schema validation, graph traversal, and SEO engines
└── styles/
    ├── tokens.css              # Mathematical OKLCH design system
    └── globals.css             # Performance-tuned layout styling
```

---

## 🔍 SEO & Machine Discoverability Specifications

Portfolio OS comes with production-grade technical SEO out-of-the-box:

1. **Structured Data (Schema.org / JSON-LD)**:
   - Emits interconnected `@graph` schema combining `Person`, `WebSite`, `CreativeWork`, `Role`, and `EducationalOrganization`.
   - Links the portfolio canonical entity directly to GitHub author profile and source repository (`codeRepository`).
2. **Metadata & OpenGraph**:
   - Comprehensive Twitter summary cards with dynamic 1200x630px canvas generation.
   - Clean self-referencing canonical URLs on every hub and detail page.
3. **Automated Search Engine Maps**:
   - Dynamic `/sitemap.xml` generated automatically from your content graph with legitimate content-derived `lastmod` dates.
   - Crawler directives in `/robots.txt` disallowing internal utility paths while maximizing search indexing efficiency.

---

## ⌨️ Command Palette & Keyboard Navigation

| Key Combination | Action |
|---|---|
| `⌘/Ctrl + K` | Trigger full-text command search across all collections |
| `⌘/Ctrl + E` | Open in-browser visual portfolio editor |
| `Esc` | Dismiss modals, search drawers, and active dialogs |
| `↑` / `↓` / `Enter` | Navigate and select search results without mouse |

---

## 📜 Available Development Commands

```bash
npm run dev          # Start local development server on port 3000
npm run build        # Build and statically pre-render all routes for production
npm start            # Run production server
npm run validate     # Validate content/portfolio.json against strict Zod schema
npm run typecheck    # Validate TypeScript type consistency across all files
npm test             # Execute test suites (schema, graph, search, analytics)
```

---

## 👤 Author & Maintainer

**Noman Ali**  
*Technical Lead & Solutions Architect*  
- Portfolio: [https://www.nomanali.online](https://www.nomanali.online)  
- GitHub: [@nomi181472](https://github.com/nomi181472)  
- LinkedIn: [linkedin.com/in/noman-a-70604a175](https://www.linkedin.com/in/noman-a-70604a175)  
- Google Scholar: [Noman Ali Citations](https://scholar.google.com/citations?user=SFLfK9oAAAAJ&hl=en)  

---

## 📄 License

This project is open-source and released under the [MIT License](LICENSE).
