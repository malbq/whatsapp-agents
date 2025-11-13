# Before

Run `./scripts/postgres.sh` to start the PostgreSQL container.
Create database with the name of the agent, e.g. `CREATE DATABASE zapid;`.
Enable pgvector extension, e.g. `CREATE EXTENSION IF NOT EXISTS vector;`.
Run `bun run --filter '@batman/<agent>' db:migrate` to apply the migrations.
