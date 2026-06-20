// Expand Pandoc/Quarto fenced divs (::: {.class}) into HTML wrappers before
// markdown-it runs. Opens carry attributes ({.class} / {#id}); closes are bare
// colon rows. Blank lines around the wrappers let markdown-it process the inner
// markdown normally (html:true passes the divs through). Callouts get a title
// row pulled from a leading "## Heading" so it does not become a document
// heading. Handles arbitrary nesting (e.g. a runnable's code fence) via a stack.

interface OpenDiv { classes: string[]; id?: string; isCallout: boolean; titlePulled: boolean }

const FENCE = /^(:{3,})\s*(\{[^}]*\})?\s*$/;

function parseAttrs(attr: string | undefined): { classes: string[]; id?: string } {
  const classes: string[] = [];
  let id: string | undefined;
  if (!attr) return { classes };
  for (const m of attr.matchAll(/([.#])([A-Za-z0-9_-]+)/g)) {
    if (m[1] === ".") classes.push(m[2]);
    else id = m[2];
  }
  return { classes, id };
}

const CALLOUT_LABEL: Record<string, string> = {
  "callout-note": "Note", "callout-tip": "Tip", "callout-important": "Important",
  "callout-warning": "Warning", "callout-caution": "Caution",
};

export function expandDivs(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  const stack: OpenDiv[] = [];

  // Inside a code fence we must not interpret ::: lines.
  let inCode = false;
  let codeMarker = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const codeOpen = line.match(/^(`{3,}|~{3,})/);
    if (inCode) {
      out.push(line);
      if (codeOpen && line.trim().startsWith(codeMarker) && line.trim().length >= codeMarker.length && !line.trim().slice(codeMarker.length).includes("`")) {
        // a closing fence of same char/length
        if (line.trim().replace(/[^`~]/g, "") === codeMarker) inCode = false;
      }
      continue;
    }
    if (codeOpen) { inCode = true; codeMarker = codeOpen[1]; out.push(line); continue; }

    const fence = line.match(FENCE);
    if (fence) {
      if (fence[2]) {
        // OPEN
        const { classes, id } = parseAttrs(fence[2]);
        const isCallout = classes.some((c) => c.startsWith("callout-"));
        const cls = ["rdr-block", ...classes.map((c) => c.startsWith("callout-") ? `rdr-callout rdr-${c}` : `rdr-${c}`)].join(" ");
        const idAttr = id ? ` id="${id}"` : "";
        out.push(`<div class="${cls}"${idAttr}>`);
        out.push("");
        stack.push({ classes, id, isCallout, titlePulled: false });
      } else {
        // CLOSE
        out.push("");
        out.push("</div>");
        stack.pop();
      }
      continue;
    }

    // Pull a callout's leading "## Title" into a title row, not a heading.
    const top = stack[stack.length - 1];
    if (top?.isCallout && !top.titlePulled) {
      const h = line.match(/^#{1,6}\s+(.*?)\s*$/);
      if (h) {
        const label = top.classes.map((c) => CALLOUT_LABEL[c]).find(Boolean) ?? "";
        out.push(`<div class="rdr-callout-title" data-label="${label}">${h[1]}</div>`);
        out.push("");
        top.titlePulled = true;
        continue;
      }
      if (line.trim() !== "") top.titlePulled = true; // body started, no title
    }

    out.push(line);
  }
  return out.join("\n");
}
