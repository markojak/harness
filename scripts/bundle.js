#!/usr/bin/env node

/**
 * Bundle script for npm distribution
 * Copies built files into dist/ for the npm package
 */

import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DIST = join(ROOT, "dist");

console.log("\\x1b[32m▪\\x1b[0m Bundling for npm distribution...\\n");

// Clean dist
if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true });
}
mkdirSync(DIST, { recursive: true });

// Copy daemon build
console.log("  Copying daemon...");
cpSync(join(ROOT, "packages/daemon/dist"), join(DIST, "daemon"), { recursive: true });

// Copy UI build
console.log("  Copying UI...");
cpSync(join(ROOT, "packages/ui/dist"), join(DIST, "ui"), { recursive: true });

// Copy fonts
console.log("  Copying fonts...");
mkdirSync(join(ROOT, "fonts"), { recursive: true });
const fontDir = join(process.env.HOME || "", "Library/Fonts");
const fonts = ["BerkeleyMono-Regular.otf", "BerkeleyMono-Medium.otf", "BerkeleyMono-SemiBold.otf", "BerkeleyMono-Bold.otf"];
for (const font of fonts) {
  const src = join(fontDir, font);
  const dest = join(ROOT, "fonts", font);
  if (existsSync(src)) {
    cpSync(src, dest);
    console.log(`    ✓ ${font}`);
  } else {
    console.log(`    ⚠ ${font} not found (will use fallback)`);
  }
}

console.log("\\n\\x1b[32m✓\\x1b[0m Bundle complete!\\n");
console.log("To test locally:");
console.log("  npm link");
console.log("  harness\\n");
