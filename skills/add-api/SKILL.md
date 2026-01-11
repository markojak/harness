# Skill: Add an API Endpoint

Add a new HTTP endpoint to the Harness daemon.

## Overview

All API routes are defined in `packages/daemon/src/system-stats.ts` inside the `createServer()` callback. The server is plain Node.js `http.createServer` - no framework.

## Step 1: Add Route Handler

Edit `packages/daemon/src/system-stats.ts`. Find the route handlers section and add your endpoint:

```typescript
// Inside createServer callback, before the static file fallback

// GET endpoint
if (req.url === "/my-endpoint" && req.method === "GET") {
  const data = await getMyData();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
  return;
}

// GET with path params
if (req.url?.startsWith("/items/") && req.method === "GET") {
  const id = req.url.split("/")[2];
  const item = await getItem(id);
  if (!item) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(item));
  return;
}

// GET with query params
if (req.url?.startsWith("/search") && req.method === "GET") {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const query = url.searchParams.get("q") || "";
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const results = await search(query, limit);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(results));
  return;
}

// POST endpoint
if (req.url === "/my-endpoint" && req.method === "POST") {
  let body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", async () => {
    try {
      const data = JSON.parse(body);
      const result = await processData(data);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
  });
  return;
}
```

## Step 2: Add Business Logic

For complex logic, create a separate module:

```typescript
// packages/daemon/src/my-feature.ts
export async function getMyData(): Promise<MyData> {
  // Implementation
}

export async function processData(input: Input): Promise<Output> {
  // Implementation
}
```

Then import in system-stats.ts:
```typescript
import { getMyData, processData } from "./my-feature.js";
```

## Response Patterns

```typescript
// Success
res.writeHead(200, { "Content-Type": "application/json" });
res.end(JSON.stringify({ data: "..." }));

// Created
res.writeHead(201, { "Content-Type": "application/json" });
res.end(JSON.stringify({ id: "new-id" }));

// No Content
res.writeHead(204);
res.end();

// Bad Request
res.writeHead(400, { "Content-Type": "application/json" });
res.end(JSON.stringify({ error: "Validation failed" }));

// Not Found
res.writeHead(404, { "Content-Type": "application/json" });
res.end(JSON.stringify({ error: "Not found" }));

// Server Error
res.writeHead(500, { "Content-Type": "application/json" });
res.end(JSON.stringify({ error: "Internal error" }));
```

## CORS

CORS headers are already set at the top of the handler:
```typescript
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, PATCH, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");
```

## Testing

```bash
pnpm build
node bin/cli.js --no-open &

# Test GET
curl http://localhost:4451/my-endpoint

# Test POST
curl -X POST http://localhost:4451/my-endpoint \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# Test with query params
curl "http://localhost:4451/search?q=test&limit=10"
```

## Adding CLI Command

If the endpoint should also be a CLI command, edit `bin/cli.js`:

```javascript
async function cmdMyCommand(flags) {
  // Call the API or implement directly
  const response = await fetch(`http://127.0.0.1:${PORT}/my-endpoint`);
  const data = await response.json();
  console.log(data);
}

// Add to command routing in main()
case "my-command":
  await cmdMyCommand(flags);
  break;
```

## Existing Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/system-stats` | GET | CPU, memory, costs |
| `/index` | GET | All projects/sessions |
| `/search` | GET | Full-text search |
| `/session/:id` | GET | Session transcript |
| `/bookmarks` | GET/POST/DELETE | Bookmark CRUD |
| `/config` | GET/POST | Configuration |
| `/projects/hide` | POST | Hide project |
| `/commit/:hash` | GET | Find commit in repos |
