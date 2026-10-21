# Agorix Web production image (issue #340). Build context: repository root.
#   docker build -f deploy/web/Dockerfile -t agorix-web .
FROM node:22.23.2-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @agorix/web...
RUN pnpm --filter @agorix/web... build

FROM nginx:alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/web/nginx.conf /etc/nginx/conf.d/agorix.conf
COPY deploy/web/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
