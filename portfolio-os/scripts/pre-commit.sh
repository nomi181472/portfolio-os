#!/usr/bin/env bash
set -e

# Pre-commit hook: Verify generated search index and embeddings are fresh when portfolio.json changes.
# If content/portfolio.json is staged, ensure portfolio.db and public/data/vectors.json are also staged
# or re-indexed before committing.

ROOT_DIR="$(git rev-parse --show-toplevel)"
PORTFOLIO_DIR="$ROOT_DIR/portfolio-os"

# Check if content/portfolio.json is staged
if git diff --cached --name-only | grep -q "portfolio.json"; then
  echo "🔍 Detected changes to portfolio.json in staged commit."

  # Change to portfolio-os directory if present, otherwise root
  if [ -d "$PORTFOLIO_DIR" ]; then
    cd "$PORTFOLIO_DIR"
  else
    cd "$ROOT_DIR"
  fi

  echo "⚡ Running 'npm run index' to ensure SQLite and vector embeddings are fresh..."
  npm run index

  # Stage generated artifacts if they are tracked or modified
  if git status --porcelain portfolio.db public/data/vectors.json | grep -q .; then
    echo "📦 Staging updated portfolio.db and public/data/vectors.json..."
    git add portfolio.db public/data/vectors.json
  fi
  echo "✓ Index freshness check passed."
fi

exit 0
