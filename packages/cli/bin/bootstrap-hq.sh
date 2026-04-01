#!/usr/bin/env bash
set -euo pipefail

# SUNCO HQ Bootstrap Script
#
# Creates the sunco-hq repo, scaffolds Next.js, installs SUNCO harness,
# and prepares for the first /sunco:new run.
#
# Usage: bash bootstrap-hq.sh [--dir <path>] [--skip-github]
#
# Prerequisites:
#   - gh CLI authenticated
#   - Node.js 24 LTS
#   - npm 11+

# ─── Parse args ───────────────────────────────────────────────────────────────

TARGET_DIR="${HOME}/sunco-hq"
SKIP_GITHUB=false
GITHUB_ORG="kwmin122"

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) TARGET_DIR="$2"; shift 2 ;;
    --skip-github) SKIP_GITHUB=true; shift ;;
    --org) GITHUB_ORG="$2"; shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " SUNCO HQ — Bootstrap"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Target: ${TARGET_DIR}"
echo " GitHub: ${SKIP_GITHUB:+skipped}${SKIP_GITHUB:-${GITHUB_ORG}/sunco-hq}"
echo ""

# ─── Step 1: Create GitHub repo ──────────────────────────────────────────────

if [[ "$SKIP_GITHUB" == "false" ]]; then
  echo "[1/6] Creating GitHub repo..."
  if gh repo view "${GITHUB_ORG}/sunco-hq" &>/dev/null; then
    echo "  Repo already exists. Cloning..."
    gh repo clone "${GITHUB_ORG}/sunco-hq" "${TARGET_DIR}" 2>/dev/null || true
  else
    gh repo create "${GITHUB_ORG}/sunco-hq" --private --description "SUNCO HQ — Team dashboard for agent workspace management" --clone --dir "${TARGET_DIR}"
  fi
else
  echo "[1/6] Skipping GitHub (--skip-github)"
  mkdir -p "${TARGET_DIR}"
  cd "${TARGET_DIR}"
  git init
fi

cd "${TARGET_DIR}"

# ─── Step 2: Scaffold Next.js ────────────────────────────────────────────────

echo "[2/6] Scaffolding Next.js 15..."
if [[ -f "package.json" ]]; then
  echo "  package.json exists, skipping scaffold"
else
  npx create-next-app@latest . \
    --typescript \
    --tailwind \
    --eslint \
    --app \
    --src-dir \
    --import-alias "@/*" \
    --use-npm \
    --no-turbopack \
    2>/dev/null || echo "  create-next-app requires interactive mode — run manually"
fi

# ─── Step 3: Install dependencies ────────────────────────────────────────────

echo "[3/6] Installing dependencies..."
npm install drizzle-orm postgres next-auth@5 @trpc/server @trpc/client @trpc/next superjson zod 2>/dev/null || true
npm install -D drizzle-kit @types/node typescript 2>/dev/null || true

# ─── Step 4: Create directory structure ──────────────────────────────────────

echo "[4/6] Creating directory structure..."
mkdir -p src/app/{"\(auth\)","\(dashboard\)",api}
mkdir -p src/components
mkdir -p src/lib/{parser,db}
mkdir -p src/server
mkdir -p drizzle

# ─── Step 5: Install SUNCO harness ──────────────────────────────────────────

echo "[5/6] Installing SUNCO harness..."
npx popcoru 2>/dev/null || echo "  SUNCO harness install requires interactive mode — run: npx popcoru"

# ─── Step 6: Copy PRD ───────────────────────────────────────────────────────

echo "[6/6] Preparing PRD..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PRD_SOURCE="${SCRIPT_DIR}/../../.planning/issues/ISSUE-003-sunco-hq.md"

if [[ -f "${PRD_SOURCE}" ]]; then
  cp "${PRD_SOURCE}" "${TARGET_DIR}/PRD.md"
  echo "  PRD copied to ${TARGET_DIR}/PRD.md"
else
  echo "  PRD source not found at ${PRD_SOURCE}"
  echo "  Copy ISSUE-003-sunco-hq.md manually to ${TARGET_DIR}/PRD.md"
fi

# ─── Initial commit ─────────────────────────────────────────────────────────

git add -A 2>/dev/null || true
git commit -m "chore: bootstrap SUNCO HQ — Next.js 15 + Tailwind + Drizzle" 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " BOOTSTRAP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo " Next steps:"
echo "   cd ${TARGET_DIR}"
echo "   /sunco:new --prd PRD.md"
echo ""
echo " This will run the SUNCO pipeline:"
echo "   new → discuss → plan → execute → verify"
echo ""
