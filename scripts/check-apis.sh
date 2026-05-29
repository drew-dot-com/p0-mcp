#!/usr/bin/env bash
# Quick health check for P0's public APIs.
# Usage: ./scripts/check-apis.sh

set -u

BASE="https://ai.0.xyz"
UA="Mozilla/5.0"

check() {
  local path="$1"
  local label="$2"
  local body
  body=$(curl -s -H "User-Agent: $UA" -H "Accept: application/json" "${BASE}${path}")
  local first120
  first120=$(printf '%s' "$body" | head -c 120)

  if [[ -z "$body" ]]; then
    printf "❌  %-30s empty response\n" "$label"
  elif [[ "$body" == "[]" ]]; then
    printf "⚠️   %-30s returned [] (empty array)\n" "$label"
  elif printf '%s' "$body" | grep -q '"error"'; then
    printf "❌  %-30s %s\n" "$label" "$first120"
  else
    printf "✅  %-30s %s\n" "$label" "$first120..."
  fi
}

echo "P0 public API health — $(date '+%Y-%m-%d %H:%M:%S')"
echo "----------------------------------------"
check "/api/banks" "banks"
check "/api/strategies" "strategies"
check "/api/wallet/7xLk17EQQ5KLDLDe44wCmupJKJjTGd8hs3eSVVhCx932" "wallet (sample address)"
