# --- Aşama 1: Bağımlılıklar ---
# package.json değişmediği sürece Docker bu katmanı cache'ten kullanır,
# bu sayede sadece kod değiştiğinde "npm ci" tekrar çalışmaz.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# --- Aşama 2: Build ---
# Prisma client üretimi ve Next.js production build burada yapılır.
FROM node:20-alpine AS builder
WORKDIR /app
# Prisma'nın Alpine Linux üzerinde query engine'i çalıştırabilmesi için openssl gerekir.
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Aşama 3: Çalışma zamanı (runner) ---
# Sadece "standalone" çıktısı + statik dosyalar taşınır, node_modules veya
# kaynak kod (.ts dosyaları) buraya kopyalanmaz.
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production
# Root olmayan kullanıcı ile çalıştırmak, container içinde bir güvenlik
# açığı istismar edilse bile zararı sınırlar (en az yetki prensibi).
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
