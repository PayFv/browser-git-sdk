import { GitWorkspace } from "browser-git-sdk";
import { createContextMenu } from "./context-menu.js";
import { renderDiff, renderFileTree } from "./file-tree.js";

const repoUrl = document.querySelector("#repo-url");
const branch = document.querySelector("#branch");
const username = document.querySelector("#username");
const token = document.querySelector("#token");
const commitMessage = document.querySelector("#commit-message");
const result = document.querySelector("#result");
const fileTree = document.querySelector("#file-tree");
const fileCount = document.querySelector("#file-count");
const currentPathEl = document.querySelector("#current-path");
const editor = document.querySelector("#editor");
const diffView = document.querySelector("#diff-view");
const diffSummary = document.querySelector("#diff-summary");
const newPath = document.querySelector("#new-path");

const initButton = document.querySelector("#init");
const syncButton = document.querySelector("#sync");
const filesButton = document.querySelector("#files");
const writeButton = document.querySelector("#write");
const diffFileButton = document.querySelector("#diff-file");
const diffAllButton = document.querySelector("#diff-all");
const commitButton = document.querySelector("#commit");
const pushButton = document.querySelector("#push");
const addFileButton = document.querySelector("#add-file");
const addDirButton = document.querySelector("#add-dir");

/** @type {import("browser-git-sdk").GitWorkspace | undefined} */
window.workspace = undefined;

/** @type {Array<{ path: string, type: "file" | "dir" }>} */
let listedEntries = [];
/** @type {string} */
let selectedPath = "";
/** @type {"file" | "dir" | ""} */
let selectedType = "";

const treeMenu = createContextMenu((actionId, context) => {
  const entry = /** @type {{ path: string, type: "file" | "dir" } | null} */ (context);
  if (actionId === "add-file") {
    newPath.value = entry?.type === "dir"
      ? `${entry.path}/untitled.txt`
      : suggestPathFor(entry, "untitled.txt");
    addFileButton.click();
    return;
  }
  if (actionId === "add-dir") {
    newPath.value = entry?.type === "dir"
      ? `${entry.path}/new-dir`
      : suggestPathFor(entry, "new-dir");
    addDirButton.click();
    return;
  }
  if (actionId === "delete") {
    if (!entry) return;
    run("remove", async () => {
      await requireWorkspace().remove(entry.path);
      if (
        selectedPath === entry.path ||
        selectedPath.startsWith(`${entry.path}/`)
      ) {
        selectedPath = "";
        selectedType = "";
        currentPathEl.textContent = "未选择文件";
        editor.value = "";
        editor.readOnly = false;
      }
      await refreshFiles();
      return { removed: entry.path, type: entry.type };
    });
  }
});

initButton.addEventListener("click", () => {
  run("init", async () => {
    window.workspace = new GitWorkspace({
      repoUrl: repoUrl.value,
      branch: branch.value,
      username: username.value,
      token: token.value,
      user: {
        name: "browser-git-sdk demo",
        email: "browser-git-sdk-demo@example.local"
      }
    });
    await window.workspace.init();
    clearWorkspaceView();
    return { initialized: true };
  });
});

syncButton.addEventListener("click", () => {
  run("sync", async () => {
    const syncResult = await requireWorkspace().sync();
    await refreshFiles();
    return syncResult;
  });
});

filesButton.addEventListener("click", () => {
  run("list files", () => refreshFiles());
});

writeButton.addEventListener("click", () => {
  run("writeFile", async () => {
    const path = requireSelectedFile();
    await requireWorkspace().writeText(path, editor.value);
    await refreshFiles();
    const status = await requireWorkspace().status();
    return { path, bytes: editor.value.length, status };
  });
});

diffFileButton.addEventListener("click", () => {
  run("diff file", async () => {
    const path = requireSelectedFile();
    const diff = await requireWorkspace().diff(path);
    showDiff(diff);
    return diff.summary;
  });
});

diffAllButton.addEventListener("click", () => {
  run("diff all", async () => {
    const diff = await requireWorkspace().diff();
    showDiff(diff);
    return diff.summary;
  });
});

commitButton.addEventListener("click", () => {
  run("commit", async () => {
    const git = requireWorkspace();
    const message = commitMessage.value.trim() || "Update from browser-git-sdk demo";
    await git.raw(["add", "."]);
    await git.commit(message);
    const status = await git.status();
    return { committed: true, message, status };
  });
});

pushButton.addEventListener("click", () => {
  run("push", async () => {
    await requireWorkspace().push();
    return { pushed: true };
  });
});

addFileButton.addEventListener("click", () => {
  run("add file", async () => {
    const path = normalizePath(newPath.value || suggestPath("untitled.txt"));
    if (!path || path.endsWith("/")) {
      throw new Error("请输入有效的文件路径，例如 docs/notes.md");
    }
    await requireWorkspace().writeText(path, "");
    await refreshFiles();
    await selectEntry({ path, type: "file" });
    newPath.value = "";
    return { created: path };
  });
});

addDirButton.addEventListener("click", () => {
  run("add dir", async () => {
    const dir = normalizePath(newPath.value || suggestPath("new-dir")).replace(/\/+$/, "");
    if (!dir) throw new Error("请输入有效的目录路径，例如 docs/assets");

    await requireWorkspace().mkdir(dir);
    await refreshFiles();
    await selectEntry({ path: dir, type: "dir" });
    newPath.value = "";
    return { createdDir: dir };
  });
});

async function refreshFiles() {
  listedEntries = await requireWorkspace().entries();
  fileCount.textContent = String(listedEntries.length);
  renderFileTree(fileTree, listedEntries, selectEntry, selectedPath, showTreeMenu);
  return {
    entries: listedEntries,
    files: listedEntries.filter((entry) => entry.type === "file").length,
    dirs: listedEntries.filter((entry) => entry.type === "dir").length
  };
}

/**
 * @param {MouseEvent} event
 * @param {{ path: string, type: "file" | "dir" } | null} entry
 */
function showTreeMenu(event, entry) {
  if (entry) {
    void selectEntry(entry);
  }

  const label = entry?.type === "dir"
    ? "Delete Dir"
    : entry?.type === "file"
      ? "Delete File"
      : "Delete";

  treeMenu.show(event, [
    { id: "add-file", label: "Add File" },
    { id: "add-dir", label: "Add Dir" },
    {
      id: "delete",
      label,
      disabled: !entry,
      danger: true
    }
  ], entry);
}

async function selectEntry(entry) {
  selectedPath = entry.path;
  selectedType = entry.type;
  currentPathEl.textContent = entry.type === "dir" ? `${entry.path}/` : entry.path;
  renderFileTree(fileTree, listedEntries, selectEntry, selectedPath);
  newPath.placeholder = `${selectionDir() || ""}path/to/name`;

  if (entry.type === "dir") {
    editor.value = "";
    editor.placeholder = `已选中目录 ${entry.path}/ ，可在此目录下 Add File / Add Dir。`;
    editor.readOnly = true;
    result.textContent = JSON.stringify({ selected: entry.path, type: "dir" }, null, 2);
    return;
  }

  editor.readOnly = false;
  editor.placeholder = "选中左侧文件后可读取 / 编辑 / 写入。";
  await run("readFile", async () => {
    const content = await requireWorkspace().readText(entry.path);
    editor.value = content;
    return { path: entry.path, bytes: content.length };
  });
}

function selectionDir() {
  return parentDirOf(selectedPath, selectedType);
}

/**
 * @param {string} path
 * @param {"file" | "dir" | ""} type
 */
function parentDirOf(path, type) {
  if (!path) return "";
  if (type === "dir") return `${path}/`;
  return path.includes("/") ? `${path.slice(0, path.lastIndexOf("/") + 1)}` : "";
}

function suggestPath(name) {
  return `${selectionDir()}${name}`;
}

/**
 * @param {{ path: string, type: "file" | "dir" } | null | undefined} entry
 * @param {string} name
 */
function suggestPathFor(entry, name) {
  if (!entry) return name;
  return `${parentDirOf(entry.path, entry.type)}${name}`;
}

function normalizePath(path) {
  return path.trim().replace(/^\/+/, "").replace(/\\/g, "/");
}

function showDiff(diff) {
  const summary = diff.summary || { filesChanged: 0, additions: 0, deletions: 0 };
  diffSummary.textContent = `${summary.filesChanged} files, +${summary.additions} -${summary.deletions}`;
  renderDiff(diffView, diff);
}

function clearWorkspaceView() {
  listedEntries = [];
  selectedPath = "";
  selectedType = "";
  fileCount.textContent = "0";
  currentPathEl.textContent = "未选择文件";
  editor.value = "";
  editor.readOnly = false;
  editor.placeholder = "选中左侧文件后可读取 / 编辑 / 写入。";
  newPath.value = "";
  fileTree.replaceChildren();
  diffSummary.textContent = "-";
  diffView.textContent = "No diff yet.";
}

function requireWorkspace() {
  if (!window.workspace) {
    throw new Error("请先点击 Init 初始化 GitWorkspace");
  }
  return window.workspace;
}

function requireSelectedFile() {
  if (!selectedPath || selectedType !== "file") {
    throw new Error("请先在左侧文件树中选择一个文件");
  }
  return selectedPath;
}

async function run(label, action) {
  result.textContent = `Running ${label}...`;
  try {
    result.textContent = JSON.stringify(await action(), null, 2);
  } catch (error) {
    result.textContent = error instanceof Error ? error.stack || error.message : String(error);
  }
}
