// Wrap wide content tables in a horizontal-scroll box so they scroll inside
// their column instead of widening the page on mobile. Bundled into the client
// (registered on window by hydrate.tsx) and run by the reader after hydration.
export function wrapTables(root: ParentNode = document): void {
  for (const t of Array.from(root.querySelectorAll("main table, .cell table"))) {
    const par = t.parentElement;
    if (!par || par.classList.contains("table-scroll")) continue;
    const box = document.createElement("div");
    box.className = "table-scroll";
    par.insertBefore(box, t);
    box.appendChild(t);
  }
}
