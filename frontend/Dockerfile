################################################################
# Multi-stage Dockerfile
#   - `dev`     → hot reload, used by docker-compose.yml
#   - `runner`  → Next.js standalone production output (Railway/Vercel)
################################################################

# ─── Base ───────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ─── Dev (used by docker-compose) ───────────────────────────────
FROM base AS dev
COPY package.json ./
RUN pnpm install --no-frozen-lockfile
COPY . .
EXPOSE 3000
ENV NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
CMD ["pnpm", "dev"]

# ─── Builder ────────────────────────────────────────────────────
FROM base AS builder

# Next.js inlines NEXT_PUBLIC_* at build time.
# Railway passes env vars via build args — declare them here so
# `pnpm build` sees the right public API URL baked into the client bundle.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ─── Runner (production — Railway/Vercel/Render) ────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Run as non-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy Next.js standalone output (server.js + minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Bind to whatever PORT Railway hands us
CMD node server.js
