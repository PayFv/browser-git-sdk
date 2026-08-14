import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const files = ["lg2_async.js", "lg2_async.wasm"];
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function findConsumerRoot(root) {
  let current = dirname(root);

  while (current !== dirname(current)) {
    if (basename(current) === "node_modules") return dirname(current);
    current = dirname(current);
  }

  return root;
}

export function copyWasmGitRuntime({ root = packageRoot, targetRoot = findConsumerRoot(root) } = {}) {
  const require = createRequire(resolve(root, "package.json"));
  const sourceDir = dirname(require.resolve(`wasm-git/${files[0]}`));
  const targetDir = resolve(targetRoot, "public/vendor/wasm-git");

  mkdirSync(targetDir, { recursive: true });

  for (const file of files) {
    copyFileSync(resolve(sourceDir, file), resolve(targetDir, file));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  copyWasmGitRuntime();
}
