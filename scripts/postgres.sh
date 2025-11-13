#!/bin/bash

docker run -d \
  --name postgres-18 \
  -e POSTGRES_DB=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -v postgres-data:/var/lib/postgresql/data \
  --restart unless-stopped \
  pgvector/pgvector:pg18
