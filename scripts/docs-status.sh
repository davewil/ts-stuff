#!/usr/bin/env bash
# Status line for the ts-stuff docs site lanes.
# Designed for Claude Code's statusline:
#   - Cache-hit (< 60s old): ~5ms — no git ops, just cat
#   - Cache-miss: ~150ms — local git only; git fetch fires in the background
#   - Silently no-ops outside a git repo or outside this project
#
# Output shape (only non-zero/non-clean bits are shown):
#   0828737* ↑1  hub-v0.3.2 ✓  docs-v0.1.3 ✓
#   feature/x 8a92b1  hub-v0.3.2 ↑3
#
# Standalone use: ./scripts/docs-status.sh

set -u

# Bail silently if not in a git repo
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Bail silently if this isn't the ts-stuff repo (statusline can fire anywhere)
REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null || true)
case "$REMOTE_URL" in
  *ts-stuff*|*davewil/ts-stuff*) ;;
  *) exit 0 ;;
esac

REPO_ROOT=$(git rev-parse --show-toplevel)
CACHE_KEY=$(printf '%s' "$REPO_ROOT" | shasum | cut -d' ' -f1)
CACHE_FILE="/tmp/docs-status-${CACHE_KEY}.out"
CACHE_TS="${CACHE_FILE}.ts"
CACHE_MAX_AGE=60   # seconds — keeps prompt-to-prompt latency near zero

# ANSI colours (Claude Code statusline honours these).
RESET=$'\033[0m'
DIM=$'\033[2m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RED=$'\033[31m'
CYAN=$'\033[36m'

# Cache hit → print and exit.
if [ -f "$CACHE_TS" ] && [ -f "$CACHE_FILE" ]; then
  now=$(date +%s)
  cached=$(cat "$CACHE_TS" 2>/dev/null || echo 0)
  if [ $((now - cached)) -lt $CACHE_MAX_AGE ]; then
    cat "$CACHE_FILE"
    exit 0
  fi
fi

# Cache miss → compute.
# Fire fetch in the background so subsequent calls see fresher tags without
# blocking this render. Cap the background process to 8s in case the network
# is slow.
( ( git fetch --tags --quiet --no-recurse-submodules 2>/dev/null ) &
  fetch_pid=$!
  ( sleep 8 && kill -0 "$fetch_pid" 2>/dev/null && kill "$fetch_pid" 2>/dev/null ) &
) >/dev/null 2>&1

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "??")

DIRTY=""
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  DIRTY="${YELLOW}*${RESET}"
fi

UNPUSHED=""
if git rev-parse '@{u}' >/dev/null 2>&1; then
  AHEAD=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
  if [ "$AHEAD" -gt 0 ]; then
    UNPUSHED=" ${YELLOW}↑${AHEAD}${RESET}"
  fi
fi

HUB_TAG=$(git tag --list 'hub-v*' --sort=-version:refname 2>/dev/null | head -1)
DOC_TAG=$(git tag --list 'docs-v*' --sort=-version:refname 2>/dev/null | head -1)

# Paths that the workflow's path filter would re-deploy on. Matching these is
# what makes a drift count "actually meaningful" — a commit touching only
# /scripts or /CLAUDE.md doesn't need a redeploy and shouldn't show as drift.
HUB_PATHS=(cheatsheets/ apps/docs-hub/ Dockerfile.docs-hub docs/)
DOC_PATHS=(cheatsheets/ Dockerfile.docs docs/)

format_tag_status() {
  local tag="$1"
  shift  # remaining args = deploy-relevant paths
  [ -z "$tag" ] && return
  local drift
  drift=$(git rev-list --count "$tag..HEAD" -- "$@" 2>/dev/null || echo 0)
  if [ "$drift" -eq 0 ]; then
    printf '  %s%s%s %s✓%s' "$CYAN" "$tag" "$RESET" "$GREEN" "$RESET"
  elif [ "$drift" -lt 5 ]; then
    printf '  %s%s%s %s↑%s%s' "$CYAN" "$tag" "$RESET" "$YELLOW" "$drift" "$RESET"
  else
    printf '  %s%s%s %s↑%s%s' "$CYAN" "$tag" "$RESET" "$RED" "$drift" "$RESET"
  fi
}

BRANCH_PART=""
if [ "$BRANCH" != "main" ]; then
  BRANCH_PART="${DIM}${BRANCH}${RESET} "
fi

OUTPUT="${BRANCH_PART}${SHA}${DIRTY}${UNPUSHED}"
OUTPUT="${OUTPUT}$(format_tag_status "$HUB_TAG" "${HUB_PATHS[@]}")"
OUTPUT="${OUTPUT}$(format_tag_status "$DOC_TAG" "${DOC_PATHS[@]}")"

# Persist cache, then print.
mkdir -p "$(dirname "$CACHE_FILE")" 2>/dev/null || true
printf '%s\n' "$OUTPUT" > "$CACHE_FILE"
date +%s > "$CACHE_TS"
printf '%s\n' "$OUTPUT"
