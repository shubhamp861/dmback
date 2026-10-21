# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS frontend-build
WORKDIR /workspace/react-code

COPY react-code/package.json react-code/package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY react-code/ ./
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM node:22-alpine AS backend-deps
WORKDIR /app

COPY node_code/package.json node_code/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS backend-build
WORKDIR /app

COPY node_code/package.json node_code/package-lock.json ./
RUN npm ci
COPY node_code/ ./
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN addgroup -S app && adduser -S -G app app

COPY --from=backend-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=backend-build --chown=app:app /app/dist ./dist
COPY --from=backend-build --chown=app:app /app/migrations ./dist/migrations
COPY --from=backend-build --chown=app:app /app/package.json ./package.json
COPY --from=frontend-build --chown=app:app /workspace/react-code/dist ./public

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/src/server.js"]
