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

# Install sqlite for db:init
# Create non-root user
RUN apk add --no-cache sqlite && \
    addgroup -g 1001 -S zapid && \
    adduser -S -u 1001 -G zapid zapid

    # Copy dependencies and app source with correct ownership
COPY --from=dependencies --chown=zapid:zapid /opt/zapid/node_modules ./node_modules
COPY --chown=zapid:zapid src ./src
COPY --chown=zapid:zapid package.json ./

# Run as non-root user
USER zapid

# Initialize database then start the server
CMD ["sh", "-c", "bun run db:init && exec bun run src/index.ts"]

