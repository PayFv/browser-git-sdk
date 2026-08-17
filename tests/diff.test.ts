import { parseDiffOutput } from "../src/diff";
import { GitWorkspace, normalizeCommitPaths } from "../src/workspace";
import type { WasmGit } from "../src/wasm";

function assertEqual(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}

const diff = parseDiffOutput(`$ git diff
diff --git a/README.md b/README.md
index 1111111..2222222 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,2 @@
 # demo
-old line
+new line
[exit 0] git diff`);

assertEqual(diff.summary.filesChanged, 1);
assertEqual(diff.summary.additions, 1);
assertEqual(diff.summary.deletions, 1);
assertEqual(diff.files[0]?.newPath, "README.md");
assertEqual(diff.files[0]?.hunks[0]?.lines[1]?.type, "delete");
assertEqual(diff.files[0]?.hunks[0]?.lines[2]?.type, "add");

const commitPaths = normalizeCommitPaths([
  "/Outputs/report.pdf",
  "Outputs/report.pdf",
  " Outputs/results.csv ",
]);
assertEqual(commitPaths.length, 2);
assertEqual(commitPaths[0], "Outputs/report.pdf");
assertEqual(commitPaths[1], "Outputs/results.csv");

let traversalRejected = false;
try {
  normalizeCommitPaths(["../secret.txt"]);
} catch {
  traversalRejected = true;
}
assertEqual(traversalRejected, true);

let optionPathRejected = false;
try {
  normalizeCommitPaths(["--all"]);
} catch {
  optionPathRejected = true;
}
assertEqual(optionPathRejected, true);

const wasmGitModule = await import(new URL("../node_modules/wasm-git/lg2_async.js", import.meta.url).href) as {
  default: (options: {
    noInitialRun: boolean;
    print: (message: string) => void;
    printErr: (message: string) => void;
  }) => Promise<WasmGit>;
};
const wasmOutput: string[] = [];
const wasmGit = await wasmGitModule.default({
  noInitialRun: true,
  print: (message) => wasmOutput.push(message),
  printErr: (message) => wasmOutput.push(message),
});

function ensureDirectory(path: string) {
  try {
    wasmGit.FS.mkdir(path);
  } catch {
    // The test runtime may already contain the directory.
  }
}

async function runWasmGit(directory: string, args: string[]) {
  wasmOutput.length = 0;
  wasmGit.FS.chdir(directory);
  const code = await wasmGit.callMain([...args]);
  if (code !== 0) throw new Error(`${args.join(" ")} failed: ${wasmOutput.join("\n")}`);
  return [...wasmOutput];
}

ensureDirectory("/home");
ensureDirectory("/home/web_user");
ensureDirectory("/repos");
ensureDirectory("/repos/scoped-commit-test");
wasmGit.FS.writeFile("/home/web_user/.gitconfig", "[user]\n\tname = Test\n\temail = test@example.com\n");
await runWasmGit("/repos/scoped-commit-test", ["init", "."]);
wasmGit.FS.writeFile("/repos/scoped-commit-test/base.txt", "base\n");
await runWasmGit("/repos/scoped-commit-test", ["add", "base.txt"]);
await runWasmGit("/repos/scoped-commit-test", ["commit", "-m", "base"]);

wasmGit.FS.writeFile("/repos/scoped-commit-test/base.txt", "staged\n");
await runWasmGit("/repos/scoped-commit-test", ["add", "base.txt"]);
wasmGit.FS.writeFile("/repos/scoped-commit-test/base.txt", "working\n");
ensureDirectory("/repos/scoped-commit-test/Outputs");
wasmGit.FS.writeFile("/repos/scoped-commit-test/Outputs/result.txt", "artifact\n");

const workspace = new GitWorkspace({
  repoUrl: "https://example.com/research.git",
  storageKey: "scoped-commit-test",
  user: { name: "Test", email: "test@example.com" },
});
(workspace as unknown as { git: WasmGit }).git = wasmGit;
await workspace.commitPaths(["Outputs/result.txt"], "artifact");

const scopedStatus = await runWasmGit("/repos/scoped-commit-test", ["status", "--short"]);
assertEqual(scopedStatus.includes("MM base.txt"), true);
assertEqual(scopedStatus.some((line) => line.includes("Outputs/result.txt")), false);

console.log("diff parser and workspace paths ok");
