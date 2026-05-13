#!/usr/bin/env node
/**
 * Pre-build step: copy rendered MP4 + GIF files from ../videos/ into
 * docs-site/public/videos/ so Astro serves them at /enterprise-tooling/videos/.
 *
 * Source of truth for the videos lives at the repo root (videos/), where
 * the .tape files + outputs are version-controlled together. The copied
 * destination is gitignored to avoid double-commit bloat.
 *
 * Runs automatically via the "prebuild" npm script. Idempotent — re-copies
 * any file whose mtime has changed.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "videos");
const DST = join(HERE, "..", "public", "videos");

if (!existsSync(SRC)) {
  console.warn(`[copy-videos] ${SRC} does not exist — skipping (videos may not be generated yet)`);
  process.exit(0);
}

mkdirSync(DST, { recursive: true });

let copied = 0;
let skipped = 0;
for (const file of readdirSync(SRC)) {
  if (!file.endsWith(".mp4") && !file.endsWith(".gif")) continue;
  const srcPath = join(SRC, file);
  const dstPath = join(DST, file);
  const srcStat = statSync(srcPath);
  if (existsSync(dstPath)) {
    const dstStat = statSync(dstPath);
    if (dstStat.mtimeMs >= srcStat.mtimeMs) {
      skipped++;
      continue;
    }
  }
  copyFileSync(srcPath, dstPath);
  copied++;
}

console.log(`[copy-videos] ${copied} copied, ${skipped} up-to-date → ${DST}`);
