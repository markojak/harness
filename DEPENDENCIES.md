# Dependencies Manifest

This document tracks all third-party dependencies, their versions, and update requirements.

## Quick Check

```bash
# Check for outdated packages
pnpm outdated

# Check system dependencies
harness doctor
```

---

## System Dependencies

External tools that should be installed on the user's system.

| Tool | Min Version | Recommended | Required | Check Command |
|------|-------------|-------------|----------|---------------|
| Node.js | 20.0.0 | 22.x LTS | ✅ Yes | `node --version` |
| npm/pnpm | 8.0.0 | Latest | ✅ Yes | `pnpm --version` |
| ripgrep | 13.0.0 | 14.x | ⭐ Recommended | `rg --version` |
| git | 2.30.0 | 2.40+ | ⭐ Recommended | `git --version` |
| SQLite | 3.35.0 | 3.40+ | Bundled | `sqlite3 --version` |

### Installation Commands

```bash
# macOS
brew install node ripgrep git

# Ubuntu/Debian
apt install nodejs ripgrep git

# Windows (via Chocolatey)
choco install nodejs ripgrep git
```

---

## Node.js Dependencies

### Core Runtime

| Package | Current | Min Required | Purpose | Update Frequency |
|---------|---------|--------------|---------|------------------|
| better-sqlite3 | ^12.6.0 | 12.0.0 | SQLite with FTS5 | Monthly |
| chokidar | ^4.0.3 | 4.0.0 | File watching | Stable |
| zod | ^4.3.5 | 4.0.0 | Schema validation | Monthly |
| dotenv | ^17.2.3 | 16.0.0 | Env config | Stable |

### Real-time Streaming

| Package | Current | Purpose | Notes |
|---------|---------|---------|-------|
| @durable-streams/client | ^0.1.5 | Stream client | Pin to minor |
| @durable-streams/server | ^0.1.6 | Stream server | Pin to minor |
| @durable-streams/state | ^0.1.5 | State sync | Pin to minor |

### AI Integration

| Package | Current | Purpose | Notes |
|---------|---------|---------|-------|
| @anthropic-ai/sdk | ^0.71.2 | AI summaries | Optional, update frequently |

### State Management

| Package | Current | Purpose | Notes |
|---------|---------|---------|-------|
| xstate | ^5.25.0 | State machines | Major version stable |
| fastq | ^1.20.1 | Async queues | Stable |

---

## UI Dependencies

### React Ecosystem

| Package | Current | Min Required | Update Policy |
|---------|---------|--------------|---------------|
| react | ^19.2.0 | 19.0.0 | Follow React releases |
| react-dom | ^19.2.0 | 19.0.0 | Match react version |

### UI Components

| Package | Current | Purpose | Notes |
|---------|---------|---------|-------|
| @radix-ui/themes | ^3.2.1 | Component library | Stable API |

### Routing & Data

| Package | Current | Purpose | Notes |
|---------|---------|---------|-------|
| @tanstack/react-router | ^1.146.2 | Client routing | Active development |
| @tanstack/db | ^0.5.18 | Client DB | Beta, pin carefully |
| @tanstack/react-db | ^0.1.62 | React bindings | Beta, pin carefully |

### Fonts

| Package | Current | Purpose |
|---------|---------|---------|
| @fontsource-variable/inter | ^5.2.8 | UI font |
| @fontsource-variable/jetbrains-mono | ^5.2.8 | Code font |
| @fontsource-variable/space-grotesk | ^5.2.10 | Display font |

### Markdown

| Package | Current | Purpose |
|---------|---------|---------|
| react-markdown | ^10.1.0 | Render markdown |
| react-syntax-highlighter | ^16.1.0 | Code highlighting |
| remark-gfm | ^4.0.1 | GitHub flavored MD |

---

## Development Dependencies

| Package | Current | Purpose |
|---------|---------|---------|
| typescript | ^5.7.3 | Type checking |
| @types/node | ^22.13.1 | Node.js types |
| @types/better-sqlite3 | ^7.6.13 | SQLite types |
| vitest | ^4.0.16 | Testing |
| tsx | ^4.19.0 | TS execution |
| esbuild | ^0.24.2 | Bundling |
| concurrently | ^9.1.2 | Script runner |
| vite | ^7.3.1 | Dev server |

---

## Update Policy

### Security Updates
Apply immediately for any security advisories.

```bash
pnpm audit
pnpm audit fix
```

### Major Version Updates
- Test thoroughly in development
- Update one major version at a time
- Document breaking changes

### Regular Updates
Run monthly:

```bash
pnpm outdated
pnpm update
```

---

## Known Compatibility Issues

### better-sqlite3
- Requires Node.js native addon compilation
- May need `node-gyp` and build tools
- Pre-built binaries available for common platforms

```bash
# If compilation fails on macOS
xcode-select --install

# If compilation fails on Linux
apt install build-essential python3
```

### @tanstack/db (Beta)
- API may change between minor versions
- Pin to exact version if stability needed
- Watch changelog before updating

### React 19
- Some ecosystem packages may lag behind
- Check compatibility before updating dependencies

---

## License Compliance

All dependencies use permissive licenses compatible with MIT:

| License | Packages |
|---------|----------|
| MIT | Most packages |
| BSD-2-Clause | dotenv |
| ISC | Some transitive deps |

Run license check:
```bash
npx license-checker --summary
```

---

## Dependency Graph

```
harness-ai
├── daemon
│   ├── better-sqlite3 (native)
│   ├── chokidar (fs watching)
│   ├── @durable-streams/* (streaming)
│   ├── @anthropic-ai/sdk (optional)
│   └── xstate (state machines)
└── ui
    ├── react + react-dom
    ├── @radix-ui/themes
    ├── @tanstack/* (routing, db)
    └── markdown rendering
```

---

## Updating This Document

When adding or updating dependencies:

1. Update this manifest
2. Note the purpose and update policy
3. Check license compatibility
4. Test with `harness doctor`
5. Document any breaking changes

Last updated: 2026-01-10
