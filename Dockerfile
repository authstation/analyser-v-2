# ── Stage 1: Frontend Build ────────────────────────────────
# Vue/Vite frontend build করতে এই stage দরকার
# Backend এর জন্য কোনো compile নেই — Bun TypeScript সরাসরি চালায়
FROM oven/bun:latest AS builder

WORKDIR /app

# bun.lock থাকলে fast install, না থাকলে package.json থেকে
COPY package.json bun.lockb* bun.lock* ./
RUN bun install --no-frozen-lockfile

COPY . .

# শুধু Vue frontend build করো (tsc লাগবে না!)
RUN bun run build:ui

# ── Stage 2: Production ─────────────────────────────────────
FROM oven/bun:latest AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV APP_PORT=3010

# Production deps only — dev tools বাদ
COPY package.json bun.lockb* bun.lock* ./
RUN bun install --production --no-frozen-lockfile

# Backend TypeScript source — Bun সরাসরি চালায়
COPY src ./src

# Vue frontend build output
COPY --from=builder /app/public ./public

# Drizzle config (migration runner এর জন্য)
COPY drizzle.config.ts ./
COPY tsconfig.json ./

EXPOSE 3010

# Health check — Coolify zero-downtime deploy এর জন্য
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3010/health || exit 1

# Bun TypeScript সরাসরি চালায় — কোনো dist/ দরকার নেই!
CMD ["bun", "src/framework/server.ts"]
