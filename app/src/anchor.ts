// Text-quote anchoring (W3C TextQuoteSelector style) for inline comment marks.
// Anchors store the selected text plus a little surrounding context; on load we
// re-find that text in the live article, so a mark survives edits elsewhere on
// the page and only "orphans" when its own quoted text is edited away.

export type Anchor = { exact: string; prefix: string; suffix: string; section: string };

const CTX = 32; // chars of context captured on each side

// findAnchor returns the [start, end) offset of the anchor's quote in text, or
// null when the quote is absent (the mark is then orphaned). Identical quotes
// are disambiguated by which occurrence's surrounding context best matches.
export function findAnchor(text: string, a: { exact: string; prefix?: string; suffix?: string }): [number, number] | null {
  if (!a.exact) return null;
  const positions: number[] = [];
  for (let i = text.indexOf(a.exact); i !== -1; i = text.indexOf(a.exact, i + 1)) positions.push(i);
  if (positions.length === 0) return null;
  if (positions.length === 1) return [positions[0], positions[0] + a.exact.length];

  let best = positions[0];
  let bestScore = -1;
  for (const p of positions) {
    const before = text.slice(Math.max(0, p - (a.prefix?.length ?? 0)), p);
    const after = text.slice(p + a.exact.length, p + a.exact.length + (a.suffix?.length ?? 0));
    let score = 0;
    if (a.prefix && before.endsWith(a.prefix)) score += a.prefix.length;
    if (a.suffix && after.startsWith(a.suffix)) score += a.suffix.length;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return [best, best + a.exact.length];
}

// --- DOM glue (browser only) ------------------------------------------------

type TextNodeRef = { node: Text; start: number };

// textIndex concatenates an element's text and maps offsets back to text nodes.
export function textIndex(root: Element): { text: string; nodes: TextNodeRef[] } {
  const nodes: TextNodeRef[] = [];
  let text = "";
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n as Text;
    // skip text already inside an existing mark (avoid nesting on re-render)
    if (t.parentElement?.closest(".rdr-cmt-mark")) continue;
    nodes.push({ node: t, start: text.length });
    text += t.data;
  }
  return { text, nodes };
}

// buildAnchor turns the current selection (assumed inside root) into an Anchor.
export function buildAnchor(root: Element, sel: Selection): Anchor | null {
  const exact = sel.toString();
  if (!exact.trim() || !sel.rangeCount) return null;
  const { text } = textIndex(root);
  // locate the selection text to capture context; fall back to no context.
  const idx = text.indexOf(exact);
  const prefix = idx > 0 ? text.slice(Math.max(0, idx - CTX), idx) : "";
  const suffix = idx >= 0 ? text.slice(idx + exact.length, idx + exact.length + CTX) : "";
  const section = nearestSectionId(sel.anchorNode);
  return { exact, prefix, suffix, section };
}

// nearestSectionId walks back to the closest preceding heading id.
function nearestSectionId(node: Node | null): string {
  let el = node instanceof Element ? node : node?.parentElement ?? null;
  while (el) {
    let sib: Element | null = el;
    while (sib) {
      if (/^H[1-6]$/.test(sib.tagName) && sib.id) return sib.id;
      sib = sib.previousElementSibling;
    }
    el = el.parentElement;
  }
  return "";
}

// markRange wraps the [start, end) text-offset span in <mark> elements built by
// makeMark, splitting across text nodes as needed.
export function markRange(nodes: TextNodeRef[], start: number, end: number, makeMark: () => HTMLElement): boolean {
  let wrapped = false;
  for (const { node, start: ns } of nodes) {
    const ne = ns + node.data.length;
    if (ne <= start || ns >= end) continue;
    const s = Math.max(start, ns) - ns;
    const e = Math.min(end, ne) - ns;
    const range = document.createRange();
    range.setStart(node, s);
    range.setEnd(node, e);
    try {
      range.surroundContents(makeMark());
      wrapped = true;
    } catch {
      // range crosses an element boundary within this node; skip safely.
    }
  }
  return wrapped;
}
