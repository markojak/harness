# Testing the Session Watcher

## Quick Verification

Run the watcher with recent filter to see only active sessions:

```bash
pnpm watch --recent
```

You should see:
- This current session showing as "Working" (since Claude is responding)
- Any other Claude Code sessions you have open

## Testing Strategies

### 1. Manual Testing with This Session

The watcher should detect this session and show status changes as we interact:

1. **Start the watcher** in one terminal:
   ```bash
   pnpm watch --recent
   ```

2. **Observe status transitions**:
   - When you send a message → status should be "Working"
   - When Claude finishes responding → status should be "Waiting for input"
   - After 5 minutes of no activity → status becomes "Idle"

### 2. Spawn a Test Session

Open a new terminal and start a simple Claude Code session:

```bash
# In a test directory
mkdir -p /tmp/test-claude-session
cd /tmp/test-claude-session
claude "say hello"
```

The watcher should show:
- `[NEW]` event when the session starts
- Status updates as the session progresses
- The session grouped under `/tmp/test-claude-session`

### 3. Test Multiple Concurrent Sessions

Open 2-3 Claude Code sessions in different directories:

```bash
# Terminal 1
cd ~/project-a && claude "explain this codebase"

# Terminal 2
cd ~/project-b && claude "help me write tests"

# Terminal 3 - watch them all
pnpm watch --active
```

Verify:
- All sessions appear grouped by their working directory
- Status updates appear in real-time as each session progresses
- The `--active` filter hides idle sessions

### 4. Test Session Lifecycle

1. Start a session: `claude "hello"`
2. Verify it appears with "Working" then "Waiting" status
3. Let it sit for 5+ minutes
4. Verify it transitions to "Idle"
5. Resume it: `claude --resume`
6. Verify status changes back to active

### 5. Test Tool Approval Detection

Start a session that will request file edits:

```bash
cd /tmp/test-dir
echo "test" > file.txt
claude "edit file.txt to say 'hello world'"
```

When Claude requests approval for the edit:
- Status should show "Needs approval" (orange indicator)
- After approving, status should change

### 6. Simulated Load Testing

To test with many sessions, you can generate mock JSONL files:

```bash
# Create a mock session file
mkdir -p ~/.claude/projects/-tmp-mock-test
cat > ~/.claude/projects/-tmp-mock-test/test-session.jsonl << 'EOF'
{"type":"user","cwd":"/tmp/mock-test","sessionId":"test-123","timestamp":"2026-01-07T12:00:00Z","message":{"role":"user","content":"test prompt"},"uuid":"a","parentUuid":null,"isSidechain":false,"userType":"external","version":"2.0.0","gitBranch":"main"}
{"type":"assistant","cwd":"/tmp/mock-test","sessionId":"test-123","timestamp":"2026-01-07T12:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"Hello!"}]},"uuid":"b","parentUuid":"a","isSidechain":false,"userType":"external","version":"2.0.0","gitBranch":"main","requestId":"req-1"}
EOF
```

The watcher should detect this mock session.

### 7. Test Edge Cases

- **Empty session file**: Create an empty `.jsonl` file - should be skipped
- **Malformed JSON**: Add a line with invalid JSON - should be skipped without crashing
- **Missing metadata**: Create a session without `cwd` field - should be skipped
- **File deletion**: Delete a session file while watching - should emit "deleted" event

## Expected Status Behavior

| Scenario | Expected Status |
|----------|-----------------|
| User just sent a message | Working |
| Claude finished responding | Waiting for input |
| Claude requested a tool | Needs approval |
| No activity for 5+ minutes | Idle |
| File deleted | Session removed from list |

## Debugging Tips

If the watcher isn't showing expected sessions:

1. Check the Claude projects directory exists:
   ```bash
   ls ~/.claude/projects/
   ```

2. Verify there are `.jsonl` files:
   ```bash
   find ~/.claude/projects -name "*.jsonl" | head -5
   ```

3. Check a session file is valid JSONL:
   ```bash
   head -3 ~/.claude/projects/*/$(ls ~/.claude/projects/*/ | head -1)
   ```

4. Run without filters to see all sessions:
   ```bash
   pnpm watch
   ```
