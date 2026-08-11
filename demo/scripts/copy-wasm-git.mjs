import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const demoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["lg2_async.js", "lg2_async.wasm"];
const candidates = [
  resolve(demoRoot, "node_modules/wasm-git"),
  resolve(demoRoot, "node_modules/browser-git-sdk/node_modules/wasm-git"),
  resolve(demoRoot, "../node_modules/wasm-git")
];

const sourceDir = candidates.find((dir) => existsSync(resolve(dir, files[0])));
if (!sourceDir) {
  throw new Error("wasm-git runtime not found. Run npm install in the repo root first.");
}

const targetDir = resolve(demoRoot, "public/vendor/wasm-git");
mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  copyFileSync(resolve(sourceDir, file), resolve(targetDir, file));
}
