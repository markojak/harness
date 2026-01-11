# Skill: Add a UI Component

Create React components for the Harness dashboard.

## Overview

The UI is built with:
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** primitives (via shadcn/ui patterns)
- **Lucide React** for icons
- **Vite** for bundling

## Step 1: Create Component File

Create `packages/ui/src/components/MyComponent.tsx`:

```tsx
import { useState } from "react";
import { cn } from "../lib/utils";
import { ChevronRight, Loader2 } from "lucide-react";

interface MyComponentProps {
  title: string;
  data: DataType[];
  onSelect?: (item: DataType) => void;
  className?: string;
}

export function MyComponent({ 
  title, 
  data, 
  onSelect,
  className 
}: MyComponentProps) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "rounded-lg border border-zinc-800 bg-zinc-900/50 p-4",
      className
    )}>
      {/* Header */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        <ChevronRight 
          className={cn(
            "h-4 w-4 text-zinc-500 transition-transform",
            expanded && "rotate-90"
          )} 
        />
      </div>

      {/* Content */}
      {expanded && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : (
            data.map((item) => (
              <div
                key={item.id}
                className="px-2 py-1.5 rounded hover:bg-zinc-800/50 cursor-pointer"
                onClick={() => onSelect?.(item)}
              >
                <span className="text-sm text-zinc-300">{item.name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

## Step 2: Use the Component

Import and use in parent component or App.tsx:

```tsx
import { MyComponent } from "./components/MyComponent";

function App() {
  return (
    <MyComponent
      title="My Section"
      data={items}
      onSelect={(item) => console.log(item)}
    />
  );
}
```

## Common Patterns

### Fetching Data

```tsx
import { useEffect, useState } from "react";

function MyComponent() {
  const [data, setData] = useState<DataType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/my-endpoint")
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  // ...
}
```

### Using Durable Streams (Real-time)

```tsx
import { useSessionState } from "../hooks/useSessionState";

function MyComponent() {
  // Sessions update in real-time via durable streams
  const { sessions, connected } = useSessionState();
  
  // ...
}
```

### Using Context

```tsx
import { useBookmarksContext } from "../context/BookmarksContext";

function MyComponent({ sessionId }: Props) {
  const { bookmarks, toggleBookmark } = useBookmarksContext();
  const isBookmarked = bookmarks.some(b => b.sessionId === sessionId);

  return (
    <button onClick={() => toggleBookmark(sessionId)}>
      {isBookmarked ? "★" : "☆"}
    </button>
  );
}
```

## Styling Reference

### Colors (Zinc palette)
```
bg-zinc-900    - Main background
bg-zinc-800    - Card/section background  
bg-zinc-700    - Hover states
text-zinc-100  - Primary text
text-zinc-300  - Secondary text
text-zinc-500  - Muted/disabled text
border-zinc-700/800 - Borders
```

### Common Classes
```
rounded-lg     - Standard border radius
p-4            - Standard padding
space-y-2      - Vertical spacing
gap-2          - Flex/grid gap
text-sm        - Standard text size
font-medium    - Semi-bold text
truncate       - Text overflow ellipsis
```

### The `cn()` Helper

Combines class names conditionally:
```tsx
import { cn } from "../lib/utils";

<div className={cn(
  "base-classes",
  condition && "conditional-classes",
  props.className  // Allow override
)} />
```

## Icons

Use Lucide React icons:
```tsx
import { 
  Search, Settings, ChevronRight, ChevronDown,
  Loader2, Check, X, Copy, ExternalLink,
  Bookmark, BookmarkCheck, Star
} from "lucide-react";

<Search className="h-4 w-4 text-zinc-500" />
```

## File Structure

```
packages/ui/src/
├── components/
│   ├── SessionCard.tsx      # Session list item
│   ├── SessionPanel.tsx     # Detail sidecar (right panel)
│   ├── ProjectSection.tsx   # Kanban column
│   ├── SearchResults.tsx    # Search result list
│   ├── StatusIndicator.tsx  # Error/job status bar
│   ├── ProviderIcon.tsx     # Provider badges
│   └── ui/                  # Base primitives (if using shadcn)
├── context/
│   └── BookmarksContext.tsx
├── hooks/
│   └── useSessionState.ts   # Durable streams hook
├── lib/
│   └── utils.ts             # cn() helper
└── App.tsx                  # Main app
```

## Testing

```bash
pnpm --filter @claude-code-ui/ui build  # Check for type errors
pnpm dev                                 # Visual testing
```

Open http://localhost:4451 to see changes (hot reload enabled in dev).
