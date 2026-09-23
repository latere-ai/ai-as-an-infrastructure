// Geometry of compiled Graphviz SVG, for choosing and correcting layouts.
//
// A flipped layout (rankdir TB laid out as LR) keeps the order of nodes inside
// one connected component, so a row that read left to right reads top to
// bottom. Separate components, including those inside one cluster, come out
// in reverse: the first-declared at the bottom. `orderReversed` detects that
// by comparing the two layouts, and `mirrorVertically` turns the drawing
// upside down while keeping text upright and in place within its box.

type Pt = { x: number; y: number };

// Node centers by node name: the middle of the bounding box of each node's
// shapes.
export function nodeCenters(svg: string): Map<string, Pt> {
  const out = new Map<string, Pt>();
  for (const m of svg.matchAll(/<g id="[^"]*" class="node[^"]*">\s*<title>([^<]*)<\/title>([\s\S]*?)<\/g>/g)) {
    const ys: number[] = [];
    const xs: number[] = [];
    for (const [, v] of m[2].matchAll(/\s(?:points|d)="([^"]*)"/g)) {
      for (const [, x, y] of v.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) { xs.push(Number(x)); ys.push(Number(y)); }
    }
    for (const e of m[2].matchAll(/\scx="(-?[\d.]+)" cy="(-?[\d.]+)"/g)) { xs.push(Number(e[1])); ys.push(Number(e[2])); }
    if (!xs.length) continue;
    out.set(m[1], { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 });
  }
  return out;
}

// True when a flipped layout lists more same-row pairs of the original layout
// in reverse order (bottom to top) than in reading order.
export function orderReversed(original: string, flipped: string): boolean {
  const a = nodeCenters(original);
  const b = nodeCenters(flipped);
  const names = [...a.keys()].filter((k) => b.has(k));
  let agree = 0;
  let disagree = 0;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const p = a.get(names[i])!, q = a.get(names[j])!;
      if (Math.abs(p.y - q.y) > 1 || Math.abs(p.x - q.x) < 1) continue; // not one row
      const P = b.get(names[i])!, Q = b.get(names[j])!;
      if (Math.abs(P.y - Q.y) < 1) continue;
      if ((p.x < q.x) === (P.y < Q.y)) agree++; else disagree++;
    }
  }
  return disagree > agree;
}

const pairs = (s: string, f: (y: number) => number) =>
  s.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_m, x, y) => `${x},${round(f(Number(y)))}`);
const round = (n: number) => Math.round(n * 100) / 100;

// Mirror a Graphviz SVG top to bottom. Shapes and edges are reflected about
// the drawing's horizontal midline. Text is moved, not reflected: a node label
// moves with its box and keeps its lines in order, and every other label
// (edge, cluster, graph) moves as one block to its reflected place. Lay the
// graph out with its graph and cluster labels on the opposite edge first
// (LayoutOptions.invertLabels), so the reflection puts them back.
export function mirrorVertically(svg: string): string {
  // The root group maps the drawing into the viewBox with translate(pad, H - pad),
  // so graph coordinates span y = pad - H .. pad and reflect as y -> H - 2 ty - y.
  const height = Number(svg.match(/<svg\b[^>]*\sviewBox="[-\d.]+ [-\d.]+ [-\d.]+ ([-\d.]+)"/)?.[1]);
  const ty = Number(svg.match(/<g id="graph0"[^>]*transform="[^"]*translate\([-\d.]+ ([-\d.]+)\)"/)?.[1]);
  if (!Number.isFinite(height) || !Number.isFinite(ty)) return svg;
  const sum = height - 2 * ty;
  const flip = (y: number) => sum - y;
  const shapeYs = (part: string) => [
    ...[...part.matchAll(/\s(?:points|d)="([^"]*)"/g)].flatMap((m) => [...m[1].matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((p) => Number(p[1]))),
    ...[...part.matchAll(/\scy="(-?[\d.]+)" rx="[\d.]+" ry="([\d.]+)"/g)].flatMap((m) => [Number(m[1]) - Number(m[2]), Number(m[1]) + Number(m[2])]),
  ];
  // Text runs of one label block share an x (Graphviz centers each line).
  const TEXT = /(<text\b[^>]*\sx="(-?[\d.]+)" y=")(-?[\d.]+)("[^>]*\sfont-size="([\d.]+)")/g;
  const blocks = (part: string) => {
    const out = new Map<string, { top: number; bottom: number }>();
    for (const m of part.matchAll(TEXT)) {
      const y = Number(m[3]), fs = Number(m[5]);
      const b = out.get(m[2]);
      const top = y - 0.8 * fs, bottom = y + 0.25 * fs;
      out.set(m[2], b ? { top: Math.min(b.top, top), bottom: Math.max(b.bottom, bottom) } : { top, bottom });
    }
    return out;
  };
  const moveText = (part: string, dy: (x: string) => number) =>
    part.replace(TEXT, (_m, pre, x, y, post) => `${pre}${round(Number(y) + dy(x))}${post}`);
  const reflectBlocks = (part: string) => {
    const b = blocks(part);
    return moveText(part, (x) => sum - b.get(x)!.top - b.get(x)!.bottom);
  };
  const mirrorShapes = (part: string) =>
    part
      .replace(/(\spoints=")([^"]*)"/g, (_m, pre, v) => `${pre}${pairs(v, flip)}"`)
      .replace(/(\sd=")([^"]*)"/g, (_m, pre, v) => `${pre}${pairs(v, flip)}"`)
      .replace(/(\scy=")(-?[\d.]+)"/g, (_m, pre, y) => `${pre}${round(flip(Number(y)))}"`);
  const GROUP = /<g id="[^"]*" class="(node|edge|cluster)[^"]*">[\s\S]*?<\/g>/g;
  const body = svg.indexOf("<g id=\"graph0\"");
  let out = svg.slice(0, body);
  let last = body;
  for (const m of svg.matchAll(GROUP)) {
    out += reflectBlocks(svg.slice(last, m.index)); // graph labels between groups
    const group = m[0];
    if (m[1] === "node") {
      const ys = shapeYs(group);
      const dy = ys.length ? sum - Math.min(...ys) - Math.max(...ys) : 0;
      out += moveText(mirrorShapes(group), () => dy);
    } else {
      out += reflectBlocks(mirrorShapes(group));
    }
    last = m.index! + group.length;
  }
  return out + reflectBlocks(svg.slice(last));
}
