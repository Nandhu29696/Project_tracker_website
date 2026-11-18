# syntax=docker/dockerfile:1
# Build context = repository root (see docker-compose.yml)

FROM node:22-alpine AS base
# pick up OS security patches newer than the base image tag
RUN apk upgrade --no-cache
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma
# postinstall runs `prisma generate` (Prisma 7: pure TS/WASM client, no native engine)
RUN npm ci --workspace @tracker/api --workspace @tracker/shared --include-workspace-root=false

# ---- development (hot reload, src mounted by docker-compose) ----
FROM base AS dev
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /app/apps/api
EXPOSE 4000
# regenerate client (src is a bind mount), apply migrations, start watcher
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npx tsx watch src/server.ts"]

# ---- build ----
FROM base AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npx prisma generate && npm run build

# ---- production runtime ----
FROM node:22-alpine AS prod
RUN apk upgrade --no-cache
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma
# prisma CLI is a runtime dependency (needed for `migrate deploy`)
RUN npm ci --omit=dev --workspace @tracker/api --include-workspace-root=false \
  && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
# attachments volume mounts here; a new named volume inherits this ownership
RUN mkdir -p apps/api/uploads && chown node:node apps/api/uploads
WORKDIR /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://localhost:4000/api/health || exit 1
# migrate, then start. Seed the first admin once with: docker compose exec api node dist/seed.js
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
