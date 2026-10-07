# Project Context & Persona Guidelines: Portfolio OS

## Context & Core Vision
Portfolio OS is a universal, data-driven, open-source personal operating system designed for **any software engineer, solutions architect, or technical professional**.

Instead of hardcoding developer profile data, contact details, projects, or metrics directly into UI components or backend routines, **all portfolio information is strictly dynamic and data-driven**. The application ingests configuration and profile data from JSON files (`portfolio.json` / `content/portfolio.json`), feeds it into **SQLite** (`portfolio.db`) and **vector embeddings/search**, and serves it dynamically across OS desktop windows, search indices, and the AI assistant.

---

## Universal Architecture Principles

1. **Zero Hardcoded Profile Data**:
   - Never hardcode candidate names, URLs, email addresses, social media links, skills, companies, projects, or statistics in the codebase or UI components.
   - All profile, project, work history, skill, and certification details must be retrieved dynamically from JSON configuration, SQLite tables, or vector stores.
   - Any hardcoded references in documentation, tests, or seed scripts must strictly serve as **explicit examples/placeholders** (e.g., `user@example.com`, `https://example.com`, `Jane Doe`).

2. **Single Source of Truth & Pipeline Flow**:
   - **Source Data**: Structured JSON file (e.g., `portfolio.json` or `content/portfolio.json`).
   - **Relational Storage**: Ingested and synchronized into SQLite (`portfolio.db`) for structured relational querying.
   - **Vector Embeddings**: Processed into vector embeddings (semantic/vector store) to power AI portfolio chat, semantic search, and contextual retrieval.
   - **Presentation Layer**: Components consume data exclusively via configuration providers, database queries, or API endpoints.

3. **Pluggable & Extensible for Any Developer**:
   - Any engineer can fork the repository, replace `portfolio.json` with their own profile, run the ingest script (e.g., `npm run ingest` / database seed), and have a fully personalized Portfolio OS.

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
