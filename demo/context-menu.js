/**
 * @typedef {{ id: string, label: string, disabled?: boolean, danger?: boolean }} ContextMenuItem
 */

/**
 * Create a reusable context menu.
 * @param {(itemId: string, context: unknown) => void} onSelect
 */
export function createContextMenu(onSelect) {
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.hidden = true;
  document.body.append(menu);

  /** @type {unknown} */
  let activeContext = null;

  const hide = () => {
    menu.hidden = true;
    activeContext = null;
  };

  /**
   * @param {MouseEvent} event
   * @param {ContextMenuItem[]} items
   * @param {unknown} context
   */
  const show = (event, items, context) => {
    event.preventDefault();
    event.stopPropagation();
    activeContext = context;
    menu.replaceChildren();

    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = item.danger ? "context-menu-item danger" : "context-menu-item";
      button.textContent = item.label;
      button.disabled = Boolean(item.disabled);
      button.addEventListener("click", () => {
        const current = activeContext;
        hide();
        onSelect(item.id, current);
      });
      menu.append(button);
    }

    menu.hidden = false;
    const { innerWidth, innerHeight } = window;
    const rect = menu.getBoundingClientRect();
    const left = Math.min(event.clientX, innerWidth - rect.width - 8);
    const top = Math.min(event.clientY, innerHeight - rect.height - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
  };

  document.addEventListener("click", hide);
  document.addEventListener("contextmenu", (event) => {
    if (!menu.contains(event.target)) hide();
  });
  window.addEventListener("blur", hide);
  window.addEventListener("resize", hide);

  return { show, hide, el: menu };
}
