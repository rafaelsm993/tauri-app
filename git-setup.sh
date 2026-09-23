#!/usr/bin/env bash
# Run this ONCE inside your project root to initialize the branch structure.
# Prerequisites: project already exists locally, GitHub repo created.
set -e

echo "── Initializing git repository ──"
git init
git add .
git commit -m "chore: initial project scaffold"

echo "── Creating branch structure ──"
# main = stable releases
git branch -M main

# dev = integration branch (all daily work goes here)
git checkout -b dev
git commit --allow-empty -m "chore: initialize dev branch"

echo "── Pushing to remote ──"
# Replace with your actual remote URL
git remote add origin https://github.com/YOUR_ORG/tauriflix.git
git push -u origin main
git push -u origin dev

echo ""
echo "Done! Branch structure:"
echo "  main  ← stable releases (protected)"
echo "  dev   ← integration (your default working branch)"
echo ""
echo "Next steps:"
echo "  1. On GitHub → Settings → Branches → add branch protection rule for 'main'"
echo "     ✓ Require PR before merging"
echo "     ✓ Require status checks (CI workflow)"
echo "  2. Set TMDB_API_KEY in GitHub → Settings → Secrets → Actions"
echo "  3. Start working: git checkout dev && git checkout -b feat/my-feature"
