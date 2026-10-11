#syntax=docker/dockerfile:1

# ------------------------------------------------------------------------------
# 1. Base stage: Node.js 22 LTS with build tools for native addons (better-sqlite3)
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Install build dependencies required for native compilation and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------------------
# 2. Dependencies stage: Clean install of dependencies
# ------------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ------------------------------------------------------------------------------
# 3. Builder stage: Validate, build application & run test suite
# ------------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Execute tests during build to ensure regression-free container artifacts
RUN npm test

# Build Next.js application
RUN npm run build

# ------------------------------------------------------------------------------
# 4. Production Runner stage: Hardened, production-ready non-root container
# ------------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -g nodejs nextjs

# Copy runtime essentials, config, source modules, and tests
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/content ./content
COPY --from=builder /app/portfolio.db ./portfolio.db
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/app ./app
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/types ./types
COPY --from=builder /app/config ./config
COPY --from=builder /app/components ./components
COPY --from=builder /app/styles ./styles
COPY --from=builder /app/tests ./tests
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Enforce secure file permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Continuous healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/p2p/channel || exit 1

CMD ["npm", "run", "start"]
