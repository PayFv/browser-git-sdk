import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const files = ["lg2_async.js", "lg2_async.wasm"];
const targetDir = resolve("public/vendor/wasm-git");

mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const source = resolve("node_modules/wasm-git", file);
  const target = resolve(targetDir, file);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
