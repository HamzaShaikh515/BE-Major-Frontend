# ─────────────────────────────────────────────────────────────
# Stage 1 – deps
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS deps

WORKDIR /app

# Copy only dependency files first (better caching)
COPY package.json package-lock.json .npmrc ./

# Install dependencies
RUN npm ci

# ─────────────────────────────────────────────────────────────
# Stage 2 – builder
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Reuse node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Build-time env (important for Next.js)
ARG NEXT_PUBLIC_API_URL=https://urbaneye-gee-production.up.railway.app
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build app
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 3 – runner
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN groupadd --system --gid 1001 nodejs \
    && useradd  --system --uid 1001 nextjs

# Copy only required files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]