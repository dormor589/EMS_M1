# ---------------------------------------------------------------------------
# EMS API — production image
#
# Multi-stage so the runtime image carries only production dependencies: the
# build stage installs everything (including devDependencies for any build
# step), and the final stage takes just what is needed to run.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app

# Copy manifests first. Docker caches this layer, so dependencies are only
# reinstalled when package.json changes — not on every source edit.
COPY package*.json ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Run as a non-root user. The node image ships one; a compromised process
# should not be root inside the container.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src

USER node

EXPOSE 5050

# Uses the API's own health endpoint, which checks the database too — so an
# API that is up but cannot reach Postgres is correctly reported unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5050/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
