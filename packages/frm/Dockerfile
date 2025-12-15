FROM oven/bun:1.3.1-alpine AS base

# Set app's working directory
WORKDIR /opt/frm

# Stage 1: Install production dependencies
FROM base AS dependencies

# Copy entire workspace to preserve structure
COPY package.json bun.lock ./
COPY packages ./packages

# Install all dependencies with workspace support
RUN bun install

# Stage 2: Build final production image
FROM base AS production

ENV NODE_ENV=production

# Download CA certificates and create non-root user
RUN apk add --no-cache ca-certificates && \
    addgroup -g 1001 -S frm && \
    adduser -S -u 1001 -G frm frm

# Copy dependencies and app source with correct ownership
COPY --chown=frm:frm packages/agent/frm ./packages/agent/frm
COPY --chown=frm:frm packages/core ./packages/core
COPY --chown=frm:frm packages/server ./packages/server
COPY --chown=frm:frm packages/whatsapp ./packages/whatsapp
COPY --chown=frm:frm package.json bun.lock ./

# Reinstall to get all dependencies with proper symlinks
RUN bun install

# Ensure the SQLite file directory exists and is writable
RUN mkdir -p packages/agent/frm/storage && chown -R frm:frm packages/agent/frm/storage

# Run as non-root user
USER frm

# Apply desired schema non-interactively on container start
CMD ["sh", "-c", "cd packages/agent/frm && mkdir -p storage && bun run db:migrate && exec bun run index.ts"]
