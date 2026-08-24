# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps — dependencias completas (dev incluidas) para poder compilar
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---------------------------------------------------------------------------
# deps-prod — SOLO dependencias de producción.
#
# Este stage existe porque el node_modules reducido que arma Next en
# .next/standalone deja afuera todo lo que no se importa desde el árbol de la
# app: en `puestos-clave` faltaba bcryptjs y eso rompía los scripts sueltos y el
# login real (bcrypt.compare() dentro de authorize()). Acá se copia el
# node_modules de producción COMPLETO a la imagen final, encima del standalone.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps-prod
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# builder
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------------------
# runner
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache wget

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# node_modules de producción completo (ver comentario del stage deps-prod).
# Va DESPUÉS del standalone para pisar su copia recortada.
COPY --from=deps-prod --chown=nextjs:nodejs /app/node_modules ./node_modules

# Migraciones, seed y scripts operativos: se corren con `docker exec`.
COPY --chown=nextjs:nodejs package.json ./package.json
COPY --chown=nextjs:nodejs db ./db
COPY --chown=nextjs:nodejs scripts ./scripts

USER nextjs
EXPOSE 3000

# 127.0.0.1 explícito, NUNCA localhost: en puestos-clave `localhost` resolvía
# primero a ::1, donde el server no escucha, y el healthcheck daba
# "Connection refused" aunque la app respondiera bien desde afuera.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
