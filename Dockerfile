# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=24.15.0

# ----------------------------------------------------------------------------
# deps: install all dependencies (dev + prod) using the lockfile.
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ----------------------------------------------------------------------------
# test: same runtime image, runs the vitest suite.
# Driven via `docker compose run --rm test`.
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS test
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vitest.config.ts ./
COPY src ./src
ENV CI=true
CMD ["pnpm", "test"]

# ----------------------------------------------------------------------------
# prod-deps: re-install with only production dependencies.
# Currently empty (no runtime deps yet); keeps the runtime stage forward-
# compatible when Fastify/Pino/etc. arrive.
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ----------------------------------------------------------------------------
# runtime: minimal image with prod deps + source. Non-root, healthchecked.
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3003

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node
EXPOSE 3003

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3003)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.ts"]
