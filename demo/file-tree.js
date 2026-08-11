/**
 * @typedef {{ path: string, type: "file" | "dir" }} WorkspaceEntry
 */

/**
 * Build a nested tree from workspace entries.
 * @param {WorkspaceEntry[]} entries
 */
export function buildFileTree(entries) {
  const root = { name: "", children: new Map(), path: "", type: "dir" };

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length; i += 1) {
      const name = parts[i];
      const atLeaf = i === parts.length - 1;
      if (!node.children.has(name)) {
        node.children.set(name, {
          name,
          children: new Map(),
          path: parts.slice(0, i + 1).join("/"),
          type: atLeaf ? entry.type : "dir"
        });
      }
      node = node.children.get(name);
      if (atLeaf) {
        node.type = entry.type;
        node.path = entry.path;
      }
    }
  }

  return root;
}

/**
 * Render file tree into a UL element.
 * @param {HTMLElement} container
 * @param {WorkspaceEntry[]} entries
 * @param {(entry: WorkspaceEntry) => void} onSelect
 * @param {string} [selectedPath]
 * @param {(event: MouseEvent, entry: WorkspaceEntry | null) => void} [onContextMenu]
 */
export function renderFileTree(container, entries, onSelect, selectedPath = "", onContextMenu) {
  container.replaceChildren();
  const root = buildFileTree(entries);

  if (onContextMenu) {
    container.oncontextmenu = (event) => {
      const target = event.target instanceof Element
        ? event.target.closest(".tree-item")
        : null;
      if (target instanceof HTMLElement && target.dataset.path && target.dataset.type) {
        onContextMenu(event, {
          path: target.dataset.path,
          type: /** @type {"file" | "dir"} */ (target.dataset.type)
        });
        return;
      }
      onContextMenu(event, null);
    };
  }

  const walk = (node, parentEl) => {
    const childNodes = [...node.children.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const child of childNodes) {
      const li = document.createElement("li");
      li.className = child.type;

      const button = document.createElement("button");
      button.type = "button";
      button.className = `tree-item tree-${child.type}`;
      button.dataset.path = child.path;
      button.dataset.type = child.type;
      button.textContent = child.type === "dir" ? `${child.name}/` : child.name;
      if (child.path === selectedPath) button.classList.add("active");
      button.addEventListener("click", () => onSelect({ path: child.path, type: child.type }));
      li.append(button);

      if (child.type === "dir" && child.children.size > 0) {
        const ul = document.createElement("ul");
        walk(child, ul);
        li.append(ul);
      }

      parentEl.append(li);
    }
  };

  walk(root, container);
}

/**
 * Render a simple colored diff view.
 * @param {HTMLElement} el
 * @param {{ raw?: string, files?: Array<{ hunks: Array<{ lines: Array<{ type: string, content: string }> }> }>, summary?: { filesChanged: number, additions: number, deletions: number } }} diff
 */
export function renderDiff(el, diff) {
  el.replaceChildren();

  if (!diff || (!diff.raw && !(diff.files && diff.files.length))) {
    el.textContent = "No changes.";
    return;
  }

  if (diff.files?.length) {
    for (const file of diff.files) {
      for (const hunk of file.hunks || []) {
        for (const line of hunk.lines || []) {
          const row = document.createElement("div");
          row.className = `diff-line diff-${line.type}`;
          const prefix = line.type === "add" ? "+" : line.type === "delete" ? "-" : " ";
          row.textContent = `${prefix}${line.content}`;
          el.append(row);
        }
      }
    }
    return;
  }

  el.textContent = diff.raw || "No changes.";
}
