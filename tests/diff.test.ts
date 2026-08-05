import { parseDiffOutput } from "../src/diff";

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

console.log("diff parser ok");
