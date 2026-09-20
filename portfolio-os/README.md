# Portfolio OS

A portfolio framework for engineers whose work does not fit on a resume.

It is built on one idea: **the content is a JSON file, and the application is a renderer for it.** Nothing about any particular person exists in the React tree. You fork this, replace one file, and it is your portfolio — a product vault, a laboratory, a research archive and an engineering history, linked to each other by a relationship graph and navigable at whatever depth the visitor wants.

The shipped content is a worked example (a fictional engineer, Nadia Verrall) so that the design can be judged against real-shaped material rather than lorem ipsum. It is flagged in the JSON and the site says so on every page.

---

## What this is

Most portfolio templates are a single long page with sections. This is not that. It is closer to a small content system:

| | |
|---|---|
| **Content** | One validated JSON document — 16 collections, ~40 example entities |
| **Structure** | Every entity has a stable URL, and references other entities by id |
| **Depth** | Seven levels, from identity down to raw research notes; each is a deliberate step |
| **Editing** | A local draft editor with undo, diff and JSON round-trip — no server, no CMS, no login |
| **Source** | Local file, or any public raw JSON URL, with automatic fallback |

### Design position

Two colours, declared once. Petrol ink carries every surface, rule and text tone; brass appears only where something is actually happening — state, focus, where you are. The entire ramp is derived from those two values with `oklch(from …)`, so replacing them in `config/portfolio.config.ts` re-skins the whole system coherently. There is no third hue anywhere.

Rules and type, not cards. Entity previews are hairline-separated rows; the only framed object on the site is media, which is genuinely in a case. Navigation is a fixed instrument rail, not a navbar. The home page's hero is a server-rendered SVG of the portfolio's own knowledge graph — node size is real collection counts, edge weight is real relationship counts — and it doubles as navigation. Motion happens once, on load, and otherwise only ever answers an action.

---

## Architecture

```
app/                      routes — server components except where interaction demands otherwise
  page.tsx                the surface: identity, schematic, layered briefing
  [category]/             one generic index route, driven by the category registry
  [category]/[slug]/      one generic detail route, statically generated per entity
  research/[slug]/        the same page plus the reader — its own segment for bundle reasons
  publications/[slug]/    likewise
  explore/  future/       conceptual entry points and the trajectory view
  startup/  edit/         the two experiences that genuinely differ
  colophon/               how the site is built, and the source state
lib/
  schema.ts               the Zod contract. The single definition of what content is
  validate.ts             path-precise errors: products[2].links[0].url, not "invalid JSON"
  graph.ts                reference resolution, derived backlinks, skill evidence
  source.ts               local / remote / fallback loading, server-only
  categories.ts           the registry: labels, metaphors, marks, detail section profiles
  search.ts  diff.ts  transfer.ts  stable-json.ts  headings.ts  format.ts
components/
  entity/EntityPageBody.tsx  one entity page, shared by all three entity routes
  layout/ entity/ media/ research/ editor/ search/ home/ metaphors/
content/portfolio.json    the content
config/portfolio.config.ts  the configuration
styles/tokens.css         the two colours and everything derived from them
types/portfolio.ts        types, inferred from the schema — never written twice
```

Three decisions are worth explaining, because they are what keep the system small:

**One route pair, not seventeen sections.** `lib/categories.ts` is a registry: each of the twelve collection categories declares its label, metaphor, mark, the question it answers, and an ordered list of detail sections. `app/[category]/page.tsx` and `app/[category]/[slug]/page.tsx` render from it. Adding a category is a registry entry, not a new page tree.

There is one deliberate exception. The markdown, maths and syntax-highlighting stack is about 320 kB of client JavaScript, and only research and publications carry long-form prose. Serving that from a single shared route would put it on every skill and award page, so those two get their own segment. All three routes render the same `EntityPageBody`; the reading routes pass the reader in as a slot, and the generic route never references it. The set is derived from the registry — a category whose sections include `body` is a reading category — so nothing is listed twice.

**Types follow the schema, not the other way round.** `types/portfolio.ts` is `z.infer` over `lib/schema.ts`. It is impossible for the compile-time and runtime models to disagree, which matters because the runtime model has to survive a stranger's JSON file.

**Backlinks are derived, never authored.** A product declares `relatedSkills`. The skill page's evidence list — "where has this actually been used" — is computed from every entity that points at it. You cannot get the two directions out of sync, because there is only one direction in the data.

---

## Installation

Requires Node 18.18 or newer.

```bash
git clone <your fork> portfolio
cd portfolio
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm run dev        # development server
npm run build      # production build; prerenders every entity page
npm start          # serve the production build
npm run typecheck  # tsc --noEmit
npm run validate   # check content/portfolio.json (or any path you pass)
npm test           # schema, round trip, graph, search
```

`npm run build` reaches out to Google Fonts to self-host Newsreader and IBM Plex at build time. On a machine with no network egress this is the one thing that will fail; see [Troubleshooting](#troubleshooting).

---

## Content model

Everything lives in one document:

```jsonc
{
  "schemaVersion": "1.0",
  "exampleContent": true,      // set false once the content is yours
  "profile":       { },        // identity + the layered briefing
  "experience":    [ ], "education":      [ ],
  "products":      [ ], "projects":       [ ],
  "research":      [ ], "publications":   [ ],
  "skills":        [ ], "startup":        { },
  "awards":        [ ], "certifications": [ ],
  "leadership":    [ ], "volunteering":   [ ],
  "languages":     [ ], "future":         { }
}
```

### The entity primitive

Every item in every collection extends the same base, which is why the renderer can be generic:

```jsonc
{
  "id": "lockkeyz",             // referenced by other entities. Stable forever
  "slug": "lockkeyz",           // the URL segment. lowercase, hyphenated
  "name": "Lockkeyz",
  "summary": "One line.",       // shown at preview depth
  "description": "A paragraph or two.",   // shown at detail depth
  "body": "# Markdown\n…",      // long-form. Only rendered at deep-dive depth
  "status": "live",
  "period": { "startDate": "2023-04", "endDate": null, "ongoing": true },
  "tags": [], "technologies": [],
  "links": [], "media": [], "evidence": [], "timeline": [],
  "featured": false,
  "order": 1,                   // optional. Otherwise sorted by date, then name
  "relatedSkills":    ["kubernetes", "pytorch"],
  "relatedProjects":  [], "relatedProducts": [], "relatedResearch": [],
  "relatedPublications": [], "relatedExperience": [], "relatedEducation": []
}
```

Categories extend it where the material demands: products add `source`, `features`, `architecture` and `metrics`; projects add `hypothesis`, `results`, `failures` and `lessons`; research adds `state`, `findings`, `datasets` and `references`; publications add `authors`, `venue` and `citation`.

### Vocabularies

These are closed sets — the validator will name the field and reject anything else.

| Field | Values |
|---|---|
| `status` | `live` `active` `in-progress` `prototype` `experimental` `in-development` `archived` `private` `coming-soon` `draft` |
| `source.type` | `open-source` `source-available` `closed-source` `private` `prototype` `experimental` |
| `research.state` | `idea` `hypothesis` `experiment` `testing` `observation` `finding` `validated` `unresolved` `archived` |
| `future.*.horizon` | `current` `exploring` `planned` `long-term` |
| `links[].visibility`, `media[].visibility` | `public` `private` `disabled` `coming-soon` |

The research states and the future horizons exist so the site can never imply that a hypothesis is a finding, or that an ambition is a shipped thing. The UI renders them with decreasing visual weight on purpose.

### Relationships

References are entity ids, in one direction only, on the seven `related*` fields. Resolution happens once at load; the reverse direction is derived. A reference to something that does not exist is reported by `npm run validate` and quietly dropped from the UI — it never throws and never renders a dead link.

### Dates and media

Dates are `YYYY`, `YYYY-MM` or `YYYY-MM-DD` strings, formatted for display at render time. `ongoing: true` with a null `endDate` means present.

Media objects carry `type` (`image` `video` `gif` `svg` `diagram` `iframe` `embed` `document`), `url`, `title`, `alt`, `caption`, `poster`, `visibility` and `ratio`. The renderer dispatches on `type`, lazy-loads, sandboxes iframes, and falls back per item — one broken embed cannot take a page down.

### URLs

Every URL in the document is checked against a protocol allowlist: `https:`, `http:`, `mailto:`, `tel:`, and site-relative paths beginning `/`. `javascript:` and `data:` are rejected at parse time, in the editor and in the CLI. This matters because the content file is expected to come from the internet.

**Assume the JSON is public.** It is a presentation source, not a secret store. Never put a key, token, credential or private URL in it.

---

## Edit mode

Press **⌘/Ctrl + E**, or open `/edit`.

The model is deliberately modest and entirely client-side: the canonical document is never mutated. Edits accumulate in a draft held in `localStorage` under `portfolio-os:draft:v1`, the presentation layer renders the draft immediately, and the only way anything becomes permanent is that you export a file and commit it yourself.

- **Editing** — pick a collection, pick an entity, edit fields. The form is generated from the shape of the data, so nested objects and arrays work without bespoke UI. URL fields validate as you type.
- **CRUD** — add, duplicate, delete and reorder entities in any collection.
- **Undo / redo** — whole-document history, 100 steps deep. Reset a field, an entity, or everything.
- **Changes** — a diff panel listing what is added, modified and removed, by path (`products[0].links[1].url`), each individually revertable. The rail shows the count at all times so you always know whether you are looking at canonical or draft content.
- **Restore** — reopening the site after a refresh offers to restore or discard the draft.

Edit mode gives your browser no privileged access to anything, and the site never claims otherwise. `/edit` is excluded in `robots.ts`.

### Import / export

**Export** validates the current draft, stamps `schemaVersion`, and serialises deterministically — keys sorted, array order preserved, trailing newline. Two exports of semantically identical content are byte-identical, so your git history shows content changes rather than formatting noise. Download or copy to clipboard.

**Import** parses, validates, and reports every problem with its path before applying anything.

There is exactly one representation. What you export is what the application reads: `import → edit → export → import` is lossless, and a test asserts it.

---

## GitHub data source

The intended workflow needs no authentication and no backend:

1. Put `portfolio.json` in a public repository — this one, or a separate data repository.
2. Point the site at its raw URL.
3. Edit locally in the browser, export, commit the file.
4. GitHub serves it; the site picks it up on the next revalidation.

Configure it in `config/portfolio.config.ts`:

```ts
dataSource: {
  type: 'remote',
  url: 'https://raw.githubusercontent.com/USERNAME/REPO/main/portfolio.json',
}
```

or at runtime, without touching code, via `.env.local`:

```
NEXT_PUBLIC_PORTFOLIO_URL=https://raw.githubusercontent.com/USERNAME/REPO/main/portfolio.json
PORTFOLIO_REVALIDATE=3600
```

Nothing about GitHub is hardcoded — any host that serves raw JSON over HTTPS works.

Loading happens on the server, so content is in the HTML for crawlers. If the remote source is unreachable, returns an error, or fails validation, the site falls back to the bundled `content/portfolio.json` and shows a quiet source notice naming the reason. There is no error screen. You can see which source is live at any time on `/colophon`.

---

## Adding content

All of the following are edits to `content/portfolio.json` — or to the draft in edit mode, exported over it. None of them require touching a component.

**A product.** Append to `products` with `id`, `slug`, `name`, `summary`, `status` and a `source` block. Everything else is optional and appears only when present: `features`, `architecture` (`{ summary, layers[], decisions[], constraints[] }`), `metrics`, `timeline`, `media`, `links`, `evidence`. Set `source.type` honestly — closed-source products render as such rather than showing a dead repository link.

**A project.** Append to `projects`. Projects are experiments, so the interesting fields are `hypothesis`, `approach`, `results`, `failures` and `lessons`. The example content includes a reproduction that did not reproduce, on purpose; a lab that only reports successes is not reporting.

**Research.** Append to `research` with a `state` from the vocabulary above and an `abstract`. Put the long-form article in `body` as Markdown — GFM tables, fenced code with highlighting, and LaTeX via `$…$` and `$$…$$` all render. The reader builds its table of contents from your headings, tracks reading progress on a hairline, and marks the active section as you scroll. `findings[]` records how a conclusion changed over time, each with its own date, confidence and status.

**Media.** Either drop files in `public/media/` and reference them as `/media/name.ext`, or point at any external URL — a CDN, object storage, a GitHub raw path. Always write real `alt` text; it is what the metaphor system falls back to.

**A new category.** Add the collection to `PortfolioSchema` in `lib/schema.ts`, then add one entry to the registry in `lib/categories.ts` with its label, metaphor, mark and section list. Routes, navigation, search, the sitemap and the graph pick it up automatically. Adding *Talks* or *Patents* is roughly twenty lines and no new components. The one exception: if the new category lists `body` in its sections, copy `app/research/[slug]/page.tsx` to `app/<your-category>/[slug]/page.tsx` and change the one `KIND` constant, so it gets the reader without putting it on everything else.

---

## Changing the design

**Colours.** Two values in `config/portfolio.config.ts` under `theme`, which are injected as `--brand-primary` and `--brand-secondary`. Everything in `styles/tokens.css` derives from them, and light mode inverts the same two seeds. Static hex fallbacks are listed first for browsers without relative colour syntax — update those to match if you change the hues substantially. Keep the discipline that makes the system work: primary is the substrate, secondary is a signal that means something. If brass starts appearing everywhere, it stops meaning anything.

**Typography.** Three roles in `app/layout.tsx`, bound to `--font-display-loaded`, `--font-ui-loaded`, `--font-data-loaded`: a display/reading serif, an interface sans, and a monospace used only where something genuinely is data. Swap the `next/font/google` imports; the scale, measure and rhythm live in `styles/tokens.css` and need no changes.

**Navigation.** `navigation.primary` and `navigation.secondary` in the config are ordered lists of category ids. The rail follows them.

**Metaphors.** `components/metaphors/MetaphorMark.tsx` holds fourteen marks drawn on one 24-unit grid with one hairline weight. If you add a mark, keep it on the grid — the family reads as a system only because they were all drawn the same way.

**Feature flags.** `features.editMode`, `search`, `graph`, `exampleNotice`.

---

## Quality

- **Rendering** — server components by default. Client code exists only for search, edit mode, the reader's scroll state, and media controls. Every entity page is prerendered at build time.
- **Bundle** — shared first-load JS is ~103 kB. Entity pages add about 10 kB on top of it. Research and publication pages carry the reading stack and land around 286 kB; nothing else on the site pays for it.
- **Accessibility** — semantic landmarks, visible focus, keyboard paths through search, the command palette and the editor, labelled SVG marks, and `prefers-reduced-motion` honoured throughout. No metaphor is load-bearing for comprehension.
- **SEO** — per-entity metadata and Open Graph, canonical URLs, generated `sitemap.xml` and `robots.txt`. Progressive disclosure is a presentation behaviour; the content is in the HTML.
- **Shortcuts** — `⌘/Ctrl + K` search, `⌘/Ctrl + E` edit mode, `Esc` to close, arrows and `Enter` in the palette.

---

## Deployment

Any host that runs Next.js 15. Vercel needs no configuration; set `NEXT_PUBLIC_PORTFOLIO_URL` in the project's environment if you are using a remote source. Set `site.url` in the config to your real domain — canonical URLs, the sitemap and Open Graph all read from it.

Fully static export works too if you keep `dataSource: { type: 'local' }`, since every route is prerendered.

### Admin dashboard

An optional private analytics view ships in this repo; it needs no external service and no build config. Sign in at `/admin/login`; the read-only view is `/admin/dashboard`. Both are server components, and auth is enforced server-side: the session is a signed, HttpOnly, SameSite=Strict cookie, and the dashboard re-verifies it on every render. There is no client-side gate you could bypass.

It is **disabled by default** and stays disabled until you set these in the environment.

| variable | purpose |
| --- | --- |
| `ANALYTICS_ADMIN_EMAIL` | login credential, half of the constant-time gate |
| `ANALYTICS_ADMIN_PASSWORD` | the other half |
| `ANALYTICS_ADMIN_SECRET` | recommended. If unset, the signing secret is derived from the two credentials, which is stable while they are unchanged |

**On Vercel:** set the three above under Settings -> Environment Variables (Production, and Preview too if you want it in preview deployments). No `vercel.json` and no middleware are required; the routes are ordinary server-rendered pages. In production the cookie is automatically `Secure; HttpOnly; SameSite=Strict`. Three variables, that is the whole deployment surface.

**Restart behaviour (the honest serverless truth):** the dashboard reads the in-memory aggregate, which is memory-only by design (no disk, no network, no store write on read, strictly bounded). On every host it survives a same-process restart. On Vercel the functions are ephemeral, so the aggregate survives **restarts within a warm instance**; a cold start resets it to zero and it re-accumulates. The optional `ANALYTICS_SNAPSHOT_DIR=/tmp/analytics` restores from a per-instance snapshot file across warm restarts, but it cannot give global cross-instance state without a network store, which this repo deliberately does not use. If you need true cross-instance persistence, you would be adding a store the design explicitly refuses; nothing here does that silently.

---

## Forking

1. Fork, `npm install`, `npm run dev`.
2. Edit `config/portfolio.config.ts` — `site`, your two `theme` colours.
3. Replace `content/portfolio.json`. Start by editing the example, which is faster than starting from an empty document.
4. Set `exampleContent: false` once the content is yours. This removes the sample notice.
5. `npm run validate` before you commit.
6. Deploy.

If you would rather keep content separate from code, put `portfolio.json` in its own public repository and point `dataSource` at its raw URL. Then updating your portfolio is a commit to a JSON file, and you never pull from this repository again unless you want the UI changes.

---

## Troubleshooting

**`npm run build` fails fetching fonts.** `next/font/google` downloads and self-hosts the typefaces at build time, so the build machine needs egress to `fonts.googleapis.com` and `fonts.gstatic.com`. In a sandbox without it, either allow those hosts or replace the three `next/font/google` calls in `app/layout.tsx` with `next/font/local` and files in `public/`. Nothing else in the build touches the network.

**Remote JSON is ignored.** Check `/colophon`, which names the live source and, if it fell back, why. Common causes: the URL is the GitHub *page* rather than the `raw.githubusercontent.com` path, the repository is private, or the file failed validation — run `npm run validate path/to/file.json` against the same file to see exactly which field.

**A link on an entity page is missing.** It is almost certainly a reference to an id that does not exist. `npm run validate` lists every dangling reference with the field that declared it. Note that references use `id`, not `slug`, even though they are usually the same string.

**Content changes do not appear.** Remote sources are cached for `PORTFOLIO_REVALIDATE` seconds (default 3600). In development, delete `.next` and restart. If you have a draft open, you are looking at the draft — the rail shows the change count; discard it in the editor to return to canonical content.

**Export is refused.** Export validates first and will not emit an invalid document. The changes panel names the failing path. This is deliberate: the export is the thing you commit.

**A page renders but a section is missing.** Sections are skipped when their data is absent rather than rendered empty. Check the field name against `lib/schema.ts` — unknown keys are stripped silently by the parser.

---

## Licence

MIT. The framework is yours to fork. The example content describes a person who does not exist; replace it.
