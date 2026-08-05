import type { GitDiff, GitDiffFile, GitStatus } from "./types";

export function parseDiffOutput(output: string): GitDiff {
  const raw = stripCommandLines(output);
  const files: GitDiffFile[] = [];
  let file: GitDiffFile | undefined;
  let hunk: GitDiffFile["hunks"][number] | undefined;
  let oldLine = 0;
  let newLine = 0;

  for (const line of raw.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      file = { oldPath: match?.[1] || "", newPath: match?.[2] || "", hunks: [] };
      files.push(file);
      hunk = undefined;
      continue;
    }

    if (!file) continue;

    if (line.startsWith("--- ")) {
      file.oldPath = line.replace(/^--- a?\//, "").replace(/^--- /, "");
      continue;
    }

    if (line.startsWith("+++ ")) {
      file.newPath = line.replace(/^\+\+\+ b?\//, "").replace(/^\+\+\+ /, "");
      continue;
    }

    const hunkMatch = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/.exec(line);
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1]);
      newLine = Number(hunkMatch[3]);
      hunk = {
        oldStart: oldLine,
        oldLines: Number(hunkMatch[2] || 1),
        newStart: newLine,
        newLines: Number(hunkMatch[4] || 1),
        lines: []
      };
      file.hunks.push(hunk);
      continue;
    }

    if (!hunk) continue;

    if (line.startsWith("+") && !line.startsWith("+++")) {
      hunk.lines.push({ type: "add", content: line.slice(1), newLine });
      newLine += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      hunk.lines.push({ type: "delete", content: line.slice(1), oldLine });
      oldLine += 1;
    } else {
      hunk.lines.push({ type: "context", content: line.startsWith(" ") ? line.slice(1) : line, oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    }
  }

  const lines = files.flatMap((item) => item.hunks).flatMap((item) => item.lines);
  return {
    raw,
    files,
    summary: {
      filesChanged: files.length,
      additions: lines.filter((line) => line.type === "add").length,
      deletions: lines.filter((line) => line.type === "delete").length
    }
  };
}

export function parseStatusOutput(output: string): GitStatus {
  const raw = stripCommandLines(output);
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  return {
    raw,
    clean: /nothing to commit|working directory clean|working tree clean|Already up-to-date/i.test(raw) || lines.length === 0,
    lines
  };
}

export function stripCommandLines(output: string) {
  return output
    .split("\n")
    .filter((line) => !line.startsWith("$ git ") && !line.startsWith("[exit "))
    .join("\n")
    .trim();
}
