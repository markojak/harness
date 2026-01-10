#!/bin/bash
# Hook script for SessionEnd events (session closed)
# Writes session-ended signal to ~/.claude/session-signals/<session_id>.ended.json
# Also cleans up all signals for this session

SIGNALS_DIR="$HOME/.claude/session-signals"
mkdir -p "$SIGNALS_DIR"

# Read JSON from stdin
INPUT=$(cat)

# Extract session_id
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

if [ -n "$SESSION_ID" ]; then
  # Write session-ended signal with timestamp
  echo "$INPUT" | jq -c '. + {ended_at: (now | tostring)}' > "$SIGNALS_DIR/$SESSION_ID.ended.json"

  # Clean up other signals for this session
  rm -f "$SIGNALS_DIR/$SESSION_ID.permission.json"
  rm -f "$SIGNALS_DIR/$SESSION_ID.stop.json"
fi
