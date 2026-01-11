# Skill: Add a New Provider

Add support for a new AI coding tool (like Cursor, Windsurf, Aider, etc.).

## Overview

Providers parse session files from AI coding tools and normalize them into a common format. Each provider needs:
1. A parser implementation
2. Registration in the provider index
3. Default config
4. A UI icon

## Step 1: Create Provider Implementation

Create `packages/daemon/src/providers/<name>.ts`:

```typescript
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import type { ProviderImplementation, RawSession } from "./types.js";

// Default path where this tool stores sessions
const DEFAULT_PATH = join(process.env.HOME || "", ".<tool>/sessions");

export const <name>Provider: ProviderImplementation = {
  name: "<name>",
  
  getDefaultPath(): string {
    return DEFAULT_PATH;
  },

  isAvailable(configPath?: string): boolean {
    const path = configPath || DEFAULT_PATH;
    return existsSync(path);
  },

  discoverSessions(configPath?: string): string[] {
    const basePath = configPath || DEFAULT_PATH;
    if (!existsSync(basePath)) return [];
    
    // Return list of session file paths
    // Adapt this to the tool's file structure
    return readdirSync(basePath)
      .filter(f => f.endsWith(".json"))
      .map(f => join(basePath, f));
  },

  parseSession(filePath: string): RawSession | null {
    try {
      const content = readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      return {
        id: data.id || basename(filePath, ".json"),
        provider: "<name>",
        cwd: data.workingDirectory || "",
        startedAt: new Date(data.createdAt).toISOString(),
        messages: data.messages?.map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })) || [],
        // Optional fields
        modelProvider: data.provider,
        modelId: data.model,
      };
    } catch {
      return null;
    }
  },

  getWatchPaths(configPath?: string): string[] {
    const basePath = configPath || DEFAULT_PATH;
    return [basePath];
  },

  getWatchPatterns(): string[] {
    return ["**/*.json"];  // Adjust for file patterns
  },
};
```

## Step 2: Register Provider

Edit `packages/daemon/src/providers/index.ts`:

```typescript
import { <name>Provider } from "./<name>.js";

export const providers: Record<string, ProviderImplementation> = {
  claude: claudeProvider,
  codex: codexProvider,
  opencode: opencodeProvider,
  <name>: <name>Provider,  // Add here
};
```

## Step 3: Add Default Config

Edit `packages/daemon/src/system-stats.ts`, find `DEFAULT_CONFIG`:

```typescript
const DEFAULT_CONFIG: HarnessConfig = {
  providers: {
    claude: { enabled: true, path: "..." },
    codex: { enabled: true, path: "..." },
    opencode: { enabled: true, path: "..." },
    <name>: {  // Add here
      enabled: true,
      path: join(HOME, ".<tool>/sessions"),
    },
  },
  // ...
};
```

## Step 4: Add UI Icon

Edit `packages/ui/src/components/ProviderIcon.tsx`:

```typescript
export type Provider = "claude" | "codex" | "opencode" | "<name>";

// Add icon in the switch statement
case "<name>":
  return (
    <div className={cn("...", className)} title="<Tool Name>">
      {/* SVG or icon */}
    </div>
  );
```

## Step 5: Update CLI Doctor

Edit `bin/cli.js`, find the `cmdDoctor` function and add the provider to the check list.

## Testing

```bash
pnpm build
node bin/cli.js doctor  # Should show new provider
node bin/cli.js sessions --provider <name>
```

## Reference: RawSession Type

```typescript
interface RawSession {
  id: string;
  provider: string;
  cwd: string;
  startedAt: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp?: string;
  }>;
  modelProvider?: string;
  modelId?: string;
}
```

## Tips

- Study existing providers in `packages/daemon/src/providers/` for patterns
- Most tools use JSONL (line-delimited JSON) or plain JSON
- Handle errors gracefully - return `null` from `parseSession` on failures
- The watcher will automatically pick up changes if paths are configured correctly
