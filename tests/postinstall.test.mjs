import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { copyWasmGitRuntime, findConsumerRoot } from "../scripts/copy-wasm-git.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("finds the project that owns an installed SDK", () => {
  assert.equal(
    findConsumerRoot("/tmp/portal/node_modules/browser-git-sdk"),
    "/tmp/portal",
  );
  assert.equal(findConsumerRoot(repoRoot), repoRoot);
});

test("copies wasm-git runtime bytes into the consumer public directory", async () => {
  const targetRoot = await mkdtemp(resolve(tmpdir(), "browser-git-sdk-"));

  try {
    copyWasmGitRuntime({ root: repoRoot, targetRoot });

    for (const file of ["lg2_async.js", "lg2_async.wasm"]) {
      const source = await readFile(resolve(repoRoot, "node_modules/wasm-git", file));
      const copied = await readFile(resolve(targetRoot, "public/vendor/wasm-git", file));
      assert.deepEqual(copied, source);
    }
  } finally {
    await rm(targetRoot, { recursive: true, force: true });
  }
});
