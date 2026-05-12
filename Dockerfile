# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=24.15.0

# ----------------------------------------------------------------------------
# deps: install all workspace dependencies using the lockfile.
# Copies every workspace manifest so pnpm can resolve the dep graph.
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/server/package.json packages/server/tsconfig.json packages/server/vitest.config.ts packages/server/
COPY apps/api/package.json apps/api/tsconfig.json apps/api/vitest.config.ts apps/api/drizzle.config.ts apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ----------------------------------------------------------------------------
# test: same runtime base, runs vitest across all workspaces.
# Driven via `docker compose run --rm test`.
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS test
WORKDIR /app
RUN corepack enable
COPY --from=deps /app ./
COPY packages/server/src ./packages/server/src
COPY apps/api/src ./apps/api/src
ENV CI=true
CMD ["pnpm", "test"]

# ----------------------------------------------------------------------------
# prod-deps: re-install with only production dependencies for runtime.
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/server/package.json packages/server/tsconfig.json packages/server/vitest.config.ts packages/server/
COPY apps/api/package.json apps/api/tsconfig.json apps/api/vitest.config.ts apps/api/drizzle.config.ts apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ----------------------------------------------------------------------------
# runtime: minimal image with prod deps + source for the api app.
# Non-root, healthchecked.
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3003

COPY --from=prod-deps --chown=node:node /app ./
COPY --chown=node:node packages/server/src ./packages/server/src
COPY --chown=node:node apps/api/src ./apps/api/src

USER node
WORKDIR /app/apps/api
EXPOSE 3003

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3003)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.ts"]
