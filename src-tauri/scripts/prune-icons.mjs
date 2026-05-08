#!/usr/bin/env node
/**
 * `tauri icon` always emits iOS / Android / MSIX leftovers; desktop-only bundles
 * only need the files listed in `tauri.conf.json` → bundle.icon.
 */
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(HERE, "..", "icons");

for (const name of readdirSync(ICONS_DIR)) {
  const full = path.join(ICONS_DIR, name);
  if (name === "ios" || name === "android") {
    rmSync(full, { recursive: true, force: true });
    continue;
  }
  if (
    name.startsWith("Square") ||
    name === "StoreLogo.png" ||
    name === "64x64.png" ||
    name === "icon.png"
  ) {
    rmSync(full, { force: true });
  }
}

console.log("图标已精简（仅桌面 bundle 用到的文件）：", readdirSync(ICONS_DIR).sort().join(", "));
