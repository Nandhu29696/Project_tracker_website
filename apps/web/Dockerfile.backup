# syntax=docker/dockerfile:1
# Build context = repository root (see docker-compose.yml)

FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @tracker/web --workspace @tracker/shared --include-workspace-root=false

# ---- development (Vite HMR, src mounted by docker-compose) ----
FROM base AS dev
COPY packages/shared packages/shared
COPY apps/web apps/web
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]

# ---- build static bundle ----
FROM base AS build
COPY packages/shared packages/shared
COPY apps/web apps/web
WORKDIR /app/apps/web
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- production: nginx serves the SPA and proxies /api to the api container ----
FROM nginx:1.27-alpine AS prod
RUN apk upgrade --no-cache
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost/ >/dev/null || exit 1
