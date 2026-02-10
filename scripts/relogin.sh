#!/usr/bin/env bash
# Clear mcp-remote token cache to force re-authentication on next use.
set -euo pipefail

AUTH_DIR="$HOME/.mcp-auth"

if [ -d "$AUTH_DIR" ]; then
  rm -rf "$AUTH_DIR"/mcp-remote-*/
  echo "Cleared mcp-remote tokens from $AUTH_DIR"
else
  echo "No mcp-remote tokens found at $AUTH_DIR"
fi

echo "Restart Claude Desktop to trigger a new login."
