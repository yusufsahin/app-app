#!/usr/bin/env node
/**
 * Bundle size budget check. Run after `npm run build`.
 * Fails if any JS chunk exceeds MAX_CHUNK_KB or total JS exceeds MAX_TOTAL_KB.
 */
import { readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");
const MAX_CHUNK_KB = 800;
const MAX_TOTAL_KB = 2500;

function getJsSizes(dir, base = "") {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      files.push(...getJsSizes(full, rel));
    } else if (e.name.endsWith(".js")) {
      const size = statSync(full).size;
      files.push({ path: rel, size });
    }
  }
  return files;
}

const jsFiles = getJsSizes(distDir);
if (jsFiles.length === 0) {
  console.error("No JS files in dist/. Run 'npm run build' first.");
  process.exit(1);
}

const totalBytes = jsFiles.reduce((s, f) => s + f.size, 0);
const totalKb = Math.round(totalBytes / 1024);
const overChunk = jsFiles.filter((f) => f.size > MAX_CHUNK_KB * 1024);
const overTotal = totalKb > MAX_TOTAL_KB;

if (overChunk.length > 0) {
  console.error(
    `Bundle size budget: chunk(s) exceed ${MAX_CHUNK_KB} KB:`,
    overChunk.map((f) => `${f.path} (${Math.round(f.size / 1024)} KB)`).join(", ")
  );
}
if (overTotal) {
  console.error(`Bundle size budget: total JS ${totalKb} KB exceeds ${MAX_TOTAL_KB} KB.`);
}
if (overChunk.length > 0 || overTotal) {
  process.exit(1);
}
console.log(`Bundle size OK: ${jsFiles.length} chunk(s), total ${totalKb} KB.`);
