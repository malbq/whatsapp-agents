#!/bin/bash

set -e

VERSION=$(grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')

if [ -z "$VERSION" ]; then
  echo "Error: Could not extract version from package.json"
  exit 1
fi

echo "Building and deploying Docker image with version: $VERSION"

export VERSION
docker compose build

echo "Successfully deployed zapid:$VERSION"

