# Lightweight First-Party Analytics — Plan

Persistent working plan for integrating a private, admin-only analytics system
into Portfolio OS. Read from the top; every section is deliberate.

> Golden rule: **the singleton stores summaries, never history.**
> Store summaries, not history. Memory is bounded. Analytics is secondary.

---

## 1. Existing architecture discovered

| Aspect          | Finding                                                        |
| --------------- | -------------------------------------------------------------- |
| Next.js         | 15.5.25, App Router, React 19.1.1                              |
| SSR             | Server Components everywhere; only Shell, Rail, MobileNav, CommandMenu, SchematicView, editor store, EditBar, CopyHub are client |
| API routes      | None exist — `app/api/` must be created                        |
| Database/Redis  | None                                                           |
| ORM             | None                                                           |
| Auth            | None                                                           |
| Chart lib       | None                                                           |
| Content         | `content/portfolio.json` + Zod schema (`lib/schema.ts`), served via `lib/source.ts` (server-only, cached promise) |
| Categories      | 12 kinds in `lib/categories.ts` + nav (explore/future/startup/copy) |
| Styling         | CSS tokens (`styles/tokens.css`) + globals.css + CSS Modules; dark default, light via `[data-appearance='light']` |
| Tests           | `node:test` via `tsx` (`npm test` → `tsx --test tests/*.test.ts`) |
| Deployment ID   | None — must derive at build time (git SHA)                     |
| Link types      | demo, repository, documentation, article, video, download, verification, website, contact |

## 2. Existing infrastructure reused

- Zod for analytics payload validation.
- `server-only` guard pattern from `lib/source.ts`.
- `portfolioConfig` + `config/portfolio.config.ts` for an analytics feature flag.
- Category registry + graph for bounded section/target allowlists.
- CSS token system (charts, dashboard draw from `--signal`, `--ink-*`, `--rule`, `--surface-*`, `--space-*`, existing `control/badge/label/meta/notice` classes).
- `node:test` runner for all new tests.
- Next.js `cookies()` / App Router for the auth guard.

## 3. Design decisions (user-confirmed)

1. **Store:** a single `AnalyticsManager` singleton on `globalThis`, aggregate-only,
   memory-bounded. Persistence is an interface (`AnalyticsStore`); default adapter is
   `MemoryOnly`. An optional file-snapshot adapter is shipped (enabled only when
   `ANALYTICS_SNAPSHOT_DIR` is set) for self-hosted `next start`. Redis/SQLite can be
   slotted in later with zero design change.
2. **Deployment target:** Vercel serverless. Singleton memory is per-instance and
   ephemeral — documented as a known limitation.
3. **Charts:** hand-rolled, dependency-free SVG primitives using the existing tokens.
4. **Admin auth:** env `ANALYTICS_ADMIN_EMAIL` / `ANALYTICS_ADMIN_PASSWORD` compared
   server-side; HMAC-signed HttpOnly cookie.

## 4. Memory-bounding strategy

- Hard key caps: countries (≈260), device (3), browsers (≈20), OS (≈20), referrer
  buckets + top-50 hostnames, sections from registry (≤ ~2000), click targets cap 500
  (overflow → 'other'), event types enum.
- Hour ring buffer: last 168 h; day ring buffer: last 90 d — fixed-size, fixed-schema.
- HyperLogLog sketch per (deployment, day) → unique visitors (≈4 KB each, ≤90).
- Bounded LRU (cap 10 000) of recent visitor ids → new/returning + frequency
  approximation; each entry carries a capped `daysActive` set (≤30 day-strings).
- Duration histograms (8 bins/section): biased avg + approximate median, no per-session list.
- Active-session `Map` with TTL 30 s, pruned on every op — bounded by concurrent traffic.

Memory stays flat regardless of traffic. Enforced by `tests/analytics-bounded.test.ts`.

## 5. Files created

```
analytics/PLAN.md, README-ANALYTICS.md
app/api/analytics/collect/route.ts
app/api/analytics/heartbeat/route.ts
app/api/analytics/login/route.ts
app/api/analytics/logout/route.ts
app/api/analytics/admin/summary/route.ts
app/api/analytics/admin/timeseries/route.ts
app/api/analytics/admin/live/route.ts
app/analytics/login/page.tsx
app/analytics/page.tsx
components/analytics/LoginForm.tsx
components/analytics/Provider.tsx
components/analytics/Dashboard.tsx
components/analytics/charts/Line.tsx Bars.tsx Donut.tsx Heatmap.tsx
lib/analytics/events.ts singleton.ts aggregate.ts sketch.ts lru.ts geo.ts
lib/analytics/deployment.ts auth.ts registry.ts metrics.ts
lib/analytics/client.ts sections.ts performance.ts
tests/analytics-events.test.ts analytics-singleton.test.ts
tests/analytics-bounded.test.ts analytics-client.test.ts analytics-metrics.test.ts
```

## 6. Files modified

- `next.config.mjs` — inject `NEXT_PUBLIC_DEPLOYMENT_ID` + `NEXT_PUBLIC_DEPLOYMENT_TIMESTAMP`.
- `config/portfolio.config.ts` — `features.analytics` flag.
- `app/layout.tsx` — mount `<AnalyticsProvider>`.
- Home / category / entity / research / publications / explore / future / startup /
  copy / colophon pages — `data-analytics-section` attributes (no visual change).
- `components/entity/Row.tsx` `EntityDetail.tsx` `layout/Footer.tsx` `layout/Rail.tsx`
  `layout/MobileNav.tsx` `search/CommandMenu.tsx` `home/SchematicView.tsx` — click
  tracking attributes / nav tracking.
- `.env.example`, `README.md`.

## 7. Env vars (see .env.example)

```
ANALYTICS_ADMIN_EMAIL
ANALYTICS_ADMIN_PASSWORD
ANALYTICS_ADMIN_SECRET          # optional, recommended
NEXT_PUBLIC_DEPLOYMENT_ID       # optional override
DEPLOYMENT_TIMESTAMP            # optional override
ANALYTICS_SNAPSHOT_DIR          # optional (self-host durability)
ANALYTICS_ENABLED               # optional kill-switch
```

## 8. Semantics

- Visitor: anonymous `crypto.randomUUID()` in `localStorage`. Refresh-safe.
- Session: separate UUID in `sessionStorage`; 30-min inactivity timeout (configurable);
  refresh within timeout reuses; ends via `pagehide`/`visibilitychange` + sendBeacon.
- Deployment: `NEXT_PUBLIC_DEPLOYMENT_ID` → git SHA → 'dev'; timestamp analog. Inlined
  at build so every client event carries it automatically.
- Country: headers `x-vercel-ip-country` → `cf-ipcountry` → `x-country-code` → lazy
  `geoip-lite` → `XX`. Raw IP never stored.
- Event types: page_view, session_start, session_end, section_enter, section_exit,
  section_view, click, project_open, external_link_click, resume_download, scroll_depth,
  heartbeat, performance.

## 9. Security

- Admin env creds only; SHA-256 constant-time compare; HMAC-signed cookie
  (`analytics_session`, httpOnly, sameSite lax, secure in prod, TTL 7 d).
- `requireAdmin()` guards `/analytics` page + `/api/analytics/admin/*`.
- Collect endpoint: zod validation, payload ≤10 KB, ≤20 events/request, rate-limited via
  bounded LRU (per visitor-id), all aggregation server-side; client values never trusted.

## 10. Failure behavior

Analytics never blocks SSR. `track()` wrapped; collection errors → 4xx/204, never thrown
into the portfolio. Store failures swallowed, only bounded deferral. If
`ANALYTICS_ENABLED=false` or `features.analytics=false`, tracker not mounted and collect
returns 204.

## 11. Known limitations

- Singleton memory is per-process → on Vercel each warm instance counts what it has seen;
  no cross-instance/cold-start history until a Redis/DB adapter is added (interface ready).
- Unique-visitor & returning metrics are approximations beyond the LRU/HLL windows and
  reset on cold start.
- Real-time "online" reflects each instance, not a merged global count.
- Without the snapshot adapter, deployment history is not retained across processes.

## 12. Testing

`npm test` (node:test via tsx). New suites cover: validation/normalization and
high-cardinality caps; aggregation, bucket rollup, deployment keying, section/click/
country; bounded memory + failure tolerance; client visitor/session/timeout logic;
duration avg/median, frequency distribution, daily appearances. Also `npm run typecheck`
and `npm run lint`.