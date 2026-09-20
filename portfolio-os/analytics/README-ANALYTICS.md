# Portfolio Analytics — Operator Notes

Private first-party analytics for Portfolio OS. Aggregate-only, memory-bounded,
admin-only dashboard.

## Enable

```bash
cp .env.example .env.local
```

Set at minimum:

```
ANALYTICS_ADMIN_EMAIL=you@example.com
ANALYTICS_ADMIN_PASSWORD=change-me
ANALYTICS_ADMIN_SECRET=<long random string>   # recommended
```

Optional:

```
NEXT_PUBLIC_DEPLOYMENT_ID=v12        # default: git short SHA at build
DEPLOYMENT_TIMESTAMP=...             # default: build time
ANALYTICS_SNAPSHOT_DIR=/var/lib/portfolio-analytics  # self-hosted durability
ANALYTICS_ENABLED=false              # kill switch (default on)
```

`NEXT_PUBLIC_*` values are inlined at build time. Changing
`NEXT_PUBLIC_DEPLOYMENT_ID` requires a rebuild.

## Routes

| Route                          | Purpose                                   |
| ------------------------------ | ----------------------------------------- |
| `/analytics/login`             | Admin login (env email + password)        |
| `/analytics`                   | Private dashboard (auth required)         |
| `/api/analytics/collect`       | Client ingestion (public)                 |
| `/api/analytics/heartbeat`     | Live presence (public)                    |
| `/api/analytics/login|logout`  | Session management                        |
| `/api/analytics/admin/*`       | Dashboard data (auth required)            |

## Deploy notes (Vercel)

- The singleton is per-function-instance and ephemeral. "Since deployment" reflects what
  a warm instance has seen. For durable cross-instance history, implement the
  `AnalyticsStore` interface (e.g. Redis/Turso) — the manager already persists through it.
- `ANALYTICS_SNAPSHOT_DIR` does not survive serverless cold starts; use it with `next start`
  on a persistent disk.

## Privacy

Anonymous UUIDs only. Raw IP is never stored — coarse country code only. No email,
message, or personal content is collected. `features.analytics: false` (portfolio config)
or `ANALYTICS_ENABLED=false` disables the tracker entirely.