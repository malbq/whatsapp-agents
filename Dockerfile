FROM oven/bun:1.2.23-alpine AS base

# Set app's working directory
WORKDIR /opt/zapid

# Stage 1: Install production dependencies
FROM base AS dependencies

# Copy manifest and lockfile to leverage Docker layer caching
COPY package.json bun.lock ./

# Install only production dependencies based on lockfile
RUN bun install --production --frozen-lockfile

# Stage 2: Build final production image
FROM base AS production

ENV NODE_ENV=production

# Install required packages and create non-root user
RUN apk add --no-cache wget ca-certificates postgresql-client && \
    wget -qO /usr/local/bin/wait-for-it https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh && \
    chmod +x /usr/local/bin/wait-for-it && \
    addgroup -g 1001 -S zapid && \
    adduser -S -u 1001 -G zapid zapid

# Copy dependencies and app source with correct ownership
COPY --from=dependencies --chown=zapid:zapid /opt/zapid/node_modules ./node_modules
COPY --chown=zapid:zapid packages ./packages
COPY --chown=zapid:zapid package.json ./
COPY --chown=zapid:zapid tsconfig.json ./

# Ensure the SQLite file directory exists and is writable
RUN mkdir -p storage && chown -R zapid:zapid storage

# Run as non-root user
USER zapid

# Wait for Postgres and apply migrations, then start the app
CMD ["sh", "-c", "wait-for-it postgres:5432 --timeout=30 -- bun run --filter @wa/core db:push && exec bun run packages/agent/zapid/server.ts"]

