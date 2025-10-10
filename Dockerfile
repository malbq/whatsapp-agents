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

# Download and verify Atlas CLI binary, then create non-root user
RUN apk add --no-cache wget ca-certificates && \
    wget -qO /usr/local/bin/atlas https://release.ariga.io/atlas/atlas-community-linux-amd64-v0.37.0 && \
    wget -qO expected.sha256 https://release.ariga.io/atlas/atlas-community-linux-amd64-v0.37.0.sha256 && \
    echo "$(cat expected.sha256)  /usr/local/bin/atlas" | sha256sum -c - && \
    rm expected.sha256 && \
    chmod +x /usr/local/bin/atlas && \
    addgroup -g 1001 -S zapid && \
    adduser -S -u 1001 -G zapid zapid

# Copy dependencies and app source with correct ownership
COPY --from=dependencies --chown=zapid:zapid /opt/zapid/node_modules ./node_modules
COPY --chown=zapid:zapid src ./src
COPY --chown=zapid:zapid package.json ./
COPY --chown=zapid:zapid atlas.hcl ./

# Ensure the SQLite file directory exists and is writable
RUN mkdir -p storage && chown -R zapid:zapid storage

# Run as non-root user
USER zapid

# Apply desired schema non-interactively on container start
CMD ["sh", "-c", "bun run db:migrate && exec bun run src/index.ts"]

