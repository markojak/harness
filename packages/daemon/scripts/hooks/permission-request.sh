#!/bin/bash
# Hook script for PermissionRequest events
# Writes pending permission info to ~/.claude/session-signals/<session_id>.permission.json
# This allows the daemon to detect when Claude Code is waiting for user approval

SIGNALS_DIR="$HOME/.claude/session-signals"
mkdir -p "$SIGNALS_DIR"

# Read JSON from stdin
INPUT=$(cat)

# Extract session_id
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

if [ -n "$SESSION_ID" ]; then
  # Write pending permission with timestamp
  echo "$INPUT" | jq -c '. + {pending_since: (now | tostring)}' > "$SIGNALS_DIR/$SESSION_ID.permission.json"
fi
