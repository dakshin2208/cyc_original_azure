# syntax=docker/dockerfile:1

##########################################################################
# Production Dockerfile for the Next.js 14 (App Router, SSR) application.
#
# Uses Next.js `output: 'standalone'` (see next.config.mjs) to produce a
# minimal self-contained server. Multi-stage build keeps the final image
# small and free of build tooling / dev dependencies.
#
# IMPORTANT: NEXT_PUBLIC_* values are inlined into the client bundle at
# BUILD time, so they must be provided as build args here (not just at
# runtime). Server-only secrets (SERVICE_ROLE_KEY, RAZORPAY_KEY_SECRET,
# GOOGLE_CREDENTIALS, ...) are injected at RUNTIME by Azure Container Apps
# and must NOT be baked into the image.
##########################################################################

# ---- Stage 1: install dependencies -------------------------------------
FROM node:20-alpine AS deps
# libc6-compat is required by some native Node modules on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install exactly what the lockfile pins (reproducible builds).
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: build the application ------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* build args -> ENV so `next build` inlines them into the
# client bundle. Passed from GitHub Actions (see .github/workflows).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# SUPABASE_SERVICE_ROLE_KEY is required at build time: every API route module
# (and lib/parameters.ts) constructs a server-side Supabase admin client at
# module scope, and `next build`'s "collect page data" phase evaluates those
# modules. It is a TRUE secret (bypasses RLS), so it is provided via a BuildKit
# secret mount — available only for this RUN, never persisted in an image layer
# or the build cache, and never copied into the final runner stage.
#
# Runs `next build` then the repo's `obfuscate` step (see package.json).
RUN --mount=type=secret,id=supabase_service_role_key \
    SUPABASE_SERVICE_ROLE_KEY="$(cat /run/secrets/supabase_service_role_key)" \
    npm run build

# ---- Stage 3: minimal production runtime -------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CYC_DATA_DIR=/app/data

# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone server + its trimmed node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets and public files are NOT included in standalone; copy them
# to the paths the standalone server expects.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Warehouse CSVs — the AI counselor's single source of truth. Baked into the
# image so /api/chat can build the warehouse offline at CYC_DATA_DIR (=/app/data).
# The 11 canonical files (SOURCE_FILES) are required; the rest are harmless.
COPY --chown=nextjs:nodejs data ./data

USER nextjs
EXPOSE 3000

# server.js is emitted by the standalone build at the app root.
CMD ["node", "server.js"]
