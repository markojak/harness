#!/bin/bash
# Hook script for Stop events (Claude's turn ended)
# Writes turn-ended signal to ~/.claude/session-signals/<session_id>.stop.json
# Also clears any pending permission for this session

SIGNALS_DIR="$HOME/.claude/session-signals"
mkdir -p "$SIGNALS_DIR"

# Read JSON from stdin
INPUT=$(cat)

# Extract session_id
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

if [ -n "$SESSION_ID" ]; then
  # Write stop signal with timestamp
  echo "$INPUT" | jq -c '. + {stopped_at: (now | tostring)}' > "$SIGNALS_DIR/$SESSION_ID.stop.json"

  # Clear working and permission signals since turn ended
  rm -f "$SIGNALS_DIR/$SESSION_ID.working.json"
  rm -f "$SIGNALS_DIR/$SESSION_ID.permission.json"
fi
