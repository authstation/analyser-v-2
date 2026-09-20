# ── Stage 1: Build ──────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# ── Stage 2: Production ─────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV APP_PORT=3010

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/tsconfig.json ./

EXPOSE 3010

CMD ["sh", "-c", "if [ \"$AUTO_MIGRATE\" != \"false\" ]; then node src/framework/maker-cli/index.mjs db:migrate --seed; fi && node src/framework/maker-cli/index.mjs serve"]

