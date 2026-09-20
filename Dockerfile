# ── Stage 1: Build Frontend & Install Dependencies ──────────
FROM oven/bun:latest AS builder

WORKDIR /app

COPY package.json ./

# Production dependencies install (runs once)
RUN bun install --production
RUN cp -r node_modules /tmp/node_modules_prod

# Full install for Vite UI build tools
RUN bun install

COPY . .

# Vue/Vite frontend build (tsc ছাড়া কেবল UI বান্ডেল)
RUN bun src/framework/maker-cli/runtime/build-ui.mjs

# ── Stage 2: Production Runner ──────────────────────────────
FROM oven/bun:latest AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV APP_PORT=3010

# Direct copy from builder — কোনো ডাবল ডাউনলোড বা ইনস্টলেশন নেই!
COPY --from=builder /tmp/node_modules_prod ./node_modules
COPY package.json ./

# Backend TypeScript source — Bun সরাসরি চালায়
COPY src ./src

# Vue frontend build output
COPY --from=builder /app/public ./public

# Config files
COPY drizzle.config.ts ./
COPY tsconfig.json ./

EXPOSE 3010

# Health check — Coolify zero-downtime deploy এর জন্য
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3010/health || exit 1

# Bun TypeScript সরাসরি চালায় — কোনো dist/ দরকার নেই!
CMD ["bun", "src/framework/server.ts"]
