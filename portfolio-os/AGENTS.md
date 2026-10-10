# Project Context & Persona Guidelines: Portfolio OS

## Context & Core Vision
Portfolio OS is a universal, data-driven, open-source personal operating system designed for **any software engineer, solutions architect, or technical professional**.

Instead of hardcoding developer profile data, contact details, projects, or metrics directly into UI components or backend routines, **all portfolio information is strictly dynamic and data-driven**. The application ingests configuration and profile data from the single source of truth inside the content folder (`content/portfolio.json`), feeds it into **SQLite** (`portfolio.db`) and **vector embeddings/search**, and serves it dynamically across OS desktop windows, search indices, the AI assistant, and the peer-to-peer communication system.

> [!NOTE]
> **Universal Template & Sample Portfolio Notice**:
> Portfolio OS is fundamentally **universal**. The data currently housed inside `content/portfolio.json` serves as a rich **sample / reference portfolio**. Any developer or architect can clone the repository, replace `content/portfolio.json` with their own credentials, projects, and work history, run `npm run index`, and immediately deploy their own personalized Portfolio OS.
>
> **Location Notice**: The primary and sole portfolio dataset file is located strictly inside `content/portfolio.json` (`portfolio-os/content/portfolio.json`). Do not maintain a duplicate root-level `portfolio.json`.

---

## Universal Architecture Principles

1. **Zero Hardcoded Profile Data**:
   - Never hardcode candidate names, URLs, email addresses, social media links, skills, companies, projects, or statistics in the codebase or UI components.
   - All profile, project, work history, skill, and certification details must be retrieved dynamically from JSON configuration, SQLite tables, or vector stores.
   - Any hardcoded references in documentation, tests, or seed scripts must strictly serve as **explicit examples/placeholders** (e.g., `user@example.com`, `https://example.com`, `Jane Doe`).

2. **Single Source of Truth & Pipeline Flow**:
   - **Source Data**: Structured JSON file residing inside the content directory (`content/portfolio.json`).
   - **Relational Storage**: Ingested and synchronized into SQLite (`portfolio.db`) for structured relational querying.
   - **Vector Embeddings**: Processed into vector embeddings (semantic/vector store) to power AI portfolio chat, semantic search, and contextual retrieval.
   - **Presentation Layer**: Components consume data exclusively via configuration providers, database queries, or API endpoints.

3. **Pluggable & Extensible for Any Developer**:
   - Any engineer can fork the repository, update `content/portfolio.json` with their own profile, run the ingest script (e.g., `npm run index` / database seed), and have a fully personalized Portfolio OS.

---

## Peer-to-Peer (P2P) Direct Communication System

Portfolio OS features a native, serverless-capable **Peer-to-Peer (P2P) direct communication system** connecting visitors directly with the portfolio owner over **WebRTC DataChannels**:

1. **Zero Central Chat Servers**:
   - WebRTC `RTCDataChannel` establishes a direct browser-to-browser data conduit with zero third-party messaging backends or recurring SaaS costs.
   - A lightweight Next.js route (`/api/p2p/signal`) serves solely as an initial signaling mailbox for WebRTC SDP offer/answer/ICE exchange and instant fallback relay during handshakes.

2. **Deterministic SQLite-Driven Channel Derivation**:
   - The public channel ID is derived dynamically from the active SQLite database (`portfolio.db` -> `getEntity('profile')` email) using SHA-256 (`deriveChannelId`).
   - Zero hardcoded email addresses, owner names, or channel IDs exist in UI components or client-side bundles.

3. **1-to-N Multi-Visitor Isolation & Chatrooms**:
   - Multiple visitors can chat simultaneously. Each visitor introduces their name to open a dedicated private session.
   - On the host dashboard (`/direct`), the owner sees individual visitor chatrooms with unread counters, live presence indicators, and activity timestamps.
   - Host replies are cryptographically addressed and routed **strictly to that visitor's private session**.

4. **Real-time Delivery & Read Receipts**:
   - Single tick (✓ `sent`): Message transmitted by visitor or host.
   - Double tick (✓✓ `delivered`): Received by the recipient's browser.
   - Blue double tick (✓✓ `read`): Recipient has actively focused and viewed the chatroom.

5. **Voice Note Audio Messaging**:
   - Mobile and desktop friendly "press & hold to record" interaction with hands-free lock and discard gestures.
   - Interactive waveform audio player with scrub bar, elapsed time, and 1x / 1.5x / 2x speed toggles.
   - Sent directly over WebRTC DataChannel / relay as Opus-encoded audio.

6. **Responsive Host Console & Entry Points**:
   - Dedicated `/direct` route for the portfolio owner, protected by an owner secret key HMAC signature (`generateHostProof`).
   - Responsive layout: Master-detail drill-down on mobile phones (`< 768px`), dual-pane sidebar on tablets and desktops.
   - Clickable `/direct` entry points embedded in the chat widget header, mode selector, and mobile navigation drawer.

---

## Primary Audience & Goal
1. **Recruiters, Hiring Managers, and Technical Leaders**:
   - Evaluating technical depth, architectural capability, systems engineering experience, and credentials.
   - Matching qualifications for software engineering, technical lead, and solutions architecture roles.
2. **Clients & Engineering Partners**:
   - Exploring services in scalable system design, monolith decomposition, AI/ML pipelines, and cloud-native platforms.

---

## Dynamic Contact & Engagement Handling
Contact methods and social links must be dynamically derived from the active portfolio dataset:
- **Email**: Extracted dynamically from `portfolio.contact.email` or SQLite database.
- **LinkedIn / GitHub / Socials**: Extracted dynamically from `portfolio.contact.socials` or links map.
- **Live Portfolio Domain**: Extracted dynamically from deployment environment variables or `portfolio.meta.site_url`.

*(Example reference only: `contact@example.com` | `https://linkedin.com/in/example` | `https://github.com/example`)*

---

## Guidelines for AI Assistant & Contributors
- **Strict Evidence Alignment**: Query SQLite and vector context before generating responses; never invent or assume credentials not present in the ingested dataset.
- **Fast Navigation & Discoverability**: Guide visitors dynamically to case studies, interactive apps, live demos, and architecture breakdowns configured in the data store.
- **Graceful Fallbacks**: Ensure robust default fallbacks when optional JSON fields or contact links are omitted by the user.
- **LLM Response Format & Real-time Streaming**:
  - Conversational LLM models (e.g. Qwen, SmolLM) generate responses in **Markdown** with dynamic hyperlinks (`[Label](url)` and internal routes like `[Project Name](/projects/slug)`), strictly derived from verified FACTS.
  - Streaming is applied **strictly to LLM-based neural models**. Deterministic keyword search and vector embedding retrievers do not use token streaming.
