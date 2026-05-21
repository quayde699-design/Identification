#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://identification-4-iwug.onrender.com/api/}"

echo "Pinging $URL ..."
if command -v curl >/dev/null 2>&1; then
  curl -fsS -m 15 "$URL" >/dev/null
elif command -v wget >/dev/null 2>&1; then
  wget -qO- --timeout=15 "$URL" >/dev/null
else
  echo "curl or wget is required to run this script." >&2
  exit 1
fi

echo "Ping successful."
