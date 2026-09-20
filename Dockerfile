# ── Stage 1: Build ──────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Increase memory — tsc + vite build হ্যাং করে কম RAM-এ
ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV NODE_ENV=development

# package.json আগে copy করলে dependency layer cache হয়
# source code বদলালে এই layer পুনরায় build হয় না
COPY package*.json ./
RUN npm ci --include=dev

# Source copy করো dependency install এর পরে
COPY . .

# Build: TypeScript compile + Vite bundle
RUN npm run build

# ── Stage 2: Production ─────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV APP_PORT=3010

# শুধু prod dependencies install — dev tools বাদ
# (drizzle-kit, typescript, tsx, biome, vitest বাদ যাবে)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Compiled output only — src/ দরকার নেই production-এ
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# drizzle config — runtime-এ migration চালাতে
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/tsconfig.json ./

# migration files — db:migrate:run এর জন্য
COPY --from=builder /app/src/database ./src/database

EXPOSE 3010

# Health check — Coolify জানবে app কখন ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3010/health || exit 1

CMD ["node", "dist/src/framework/server.js"]
