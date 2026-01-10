# DESIGN.md — Harness Visual Language

## Philosophy

Terminal-native. Dense. Information-rich. No unnecessary chrome.

Inspired by omarchy, Factory.ai, and classic terminal UIs. Every pixel earns its place.

---

## Color Palette

```css
:root {
  /* Backgrounds — near black, subtle layering */
  --bg-base: #0a0a0a;
  --bg-surface: #111111;
  --bg-elevated: #1a1a1a;
  --bg-hover: #222222;

  /* Borders — barely visible structure */
  --border-subtle: #1f1f1f;
  --border-default: #2a2a2a;
  --border-strong: #3a3a3a;

  /* Text — high contrast, clear hierarchy */
  --text-primary: #e0e0e0;
  --text-secondary: #888888;
  --text-tertiary: #555555;
  --text-muted: #444444;

  /* Accents — terminal-style, functional */
  --accent-green: #00ff88;      /* success, working, active */
  --accent-cyan: #00d4ff;       /* links, interactive, user */
  --accent-orange: #ff9500;     /* warning, needs approval */
  --accent-yellow: #ffcc00;     /* waiting, pending */
  --accent-red: #ff4444;        /* error, critical */
  --accent-purple: #a78bfa;     /* tools, system */
}
```

---

## Typography

**Font:** Berkeley Mono — everywhere. No exceptions.

```css
body {
  font-family: 'Berkeley Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  letter-spacing: -0.01em;
}

/* Size scale */
--text-xs: 10px;
--text-sm: 11px;
--text-base: 13px;
--text-lg: 15px;
--text-xl: 18px;
```

---

## Spacing

8px grid. Tight but breathable.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
```

---

## Components

### Cards

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;          /* minimal, not rounded */
  padding: 12px 16px;
}

.card:hover {
  border-color: var(--border-default);
}
```

### Status Indicators

Square blocks, not circles. Terminal-native.

```css
.status-dot {
  width: 8px;
  height: 8px;
  background: var(--accent-green);
  /* no border-radius */
}

/* Or text-based */
.status::before {
  content: "●";  /* ▪ ▸ ◆ also valid */
  color: var(--accent-green);
}
```

### Buttons

Ghost by default. Borders on hover.

```css
.btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: 2px;
}

.btn:hover {
  border-color: var(--border-default);
  color: var(--text-primary);
}
```

### Inputs

Blend in. Reveal on focus.

```css
.input {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  padding: 8px 12px;
  border-radius: 2px;
}

.input:focus {
  border-color: var(--accent-cyan);
  outline: none;
}
```

---

## Layout

### Header Bar

Fixed top. Contains: logo, status indicator, search, stats, time.

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ HARNESS  [status]     🔍 Search sessions...     $490 │ 07:24 │
└─────────────────────────────────────────────────────────────────┘
```

### Status Indicator (dual cycling slots)

Position: After logo, before search.

**Layout:** Two independent slots, side by side.

```
│ ⚡ HARNESS   ⚠ ripgrep missing    ⣾ Indexing 147/267...       │
│              └─ errors slot       └─ jobs slot                │
```

**Behavior:**

| Errors | Jobs | Display |
|--------|------|---------|
| 0 | 0 | Nothing (both hidden) |
| 1+ | 0 | Errors only |
| 0 | 1+ | Jobs only |
| 1+ | 1+ | Both, horizontal |

**Cycling:**
- Errors: 5-6s cycle, persist until resolved
- Jobs: 3s cycle
- Each slot cycles independently — never mix content

**Interaction:**
- Hover → pause that slot's cycle, reveal copy icon (⎘)
- Click → copy relevant command (e.g., `brew install ripgrep`)
- Subtle toast: "Copied: brew install ripgrep"

```
⚠ ripgrep missing ⎘     ← hover state, copy icon visible
```

**Job priority:**
1. Running jobs (show)
2. Queued jobs (skip if running exists, or show count: "2 queued")

### Kanban Columns

4 columns, flexible width.

```
│ Working    │ Approval   │ Waiting    │ Idle              │
│ (green)    │ (orange)   │ (yellow)   │ (gray, collapsed) │
```

### Session Cards

Dense. Key info only.

```
┌────────────────────────────────────────────────────┐
│ ● Add auth middleware to API routes                │
│                                                    │
│ project-name · main · 8m ago              $0.12    │
└────────────────────────────────────────────────────┘
```

---

## Animations

Minimal. Functional.

- **Spinner:** Braille cycle `⣾⣽⣻⢿⡿⣟⣯⣷` at 80ms
- **Transitions:** 150ms ease-out for hover states
- **Slide panels:** 200ms ease-out
- **Status cycling:** Crossfade 200ms

---

## Icons

Text-based where possible. Unicode symbols > icon fonts.

```
✓ success     ✗ error       ⚠ warning
● status      ◦ inactive    ⎘ copy
▸ expand      ▾ collapse    ⣾ loading
★ bookmarked  ☆ not bookmarked
```

---

## Don'ts

- ❌ Rounded corners > 4px
- ❌ Drop shadows
- ❌ Gradients
- ❌ Icon fonts (use Unicode)
- ❌ Colors outside the palette
- ❌ Sans-serif fonts
- ❌ Padding > 24px
- ❌ Empty states with illustrations

---

## Responsive

Desktop-first. 1024px minimum width.

Mobile: Not a priority. This is a developer tool.

---

## Reference

- [omarchy](https://github.com/getomni/omarchy) — terminal aesthetic
- [Factory.ai](https://factory.ai) — dense data display
- Classic TUIs: htop, lazygit, tig
