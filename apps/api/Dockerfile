# syntax=docker/dockerfile:1

# ── Stage 1: Base ─────────────────────────────
FROM node:20-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && \
    rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# ── Stage 2: Prune ────────────────────────────
FROM base AS prune

RUN pnpm add -g turbo@^2.8.0
COPY . .
RUN turbo prune @motovault/api --docker

# ── Stage 3: Install & Build ──────────────────
FROM base AS installer

COPY --from=prune /app/out/json/ .

ENV COREPACK_ENABLE_STRICT=0
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    npm pkg delete scripts.prepare && \
    pnpm install --frozen-lockfile

COPY --from=prune /app/out/full/ .

RUN pnpm turbo build --filter=@motovault/api

# Use pnpm deploy to create a self-contained app directory
# Delete prepare script again since full source was re-copied
RUN npm pkg delete scripts.prepare && \
    pnpm --filter @motovault/api deploy --prod /app/deployed

# ── Stage 4: Production ───────────────────────
FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 nestjs && \
    useradd -u 1001 -g nestjs -m -d /app -s /bin/false nestjs

WORKDIR /app

# Copy the self-contained deployed output
COPY --from=installer --chown=nestjs:nestjs /app/deployed/node_modules ./node_modules
COPY --from=installer --chown=nestjs:nestjs /app/apps/api/dist ./dist
COPY --from=installer --chown=nestjs:nestjs /app/deployed/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=10000

USER nestjs
EXPOSE 10000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
