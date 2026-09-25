// The book on the home page responds like one picked up from a table: it
// turns toward the pointer, lifts a little, its layers shift against each
// other by depth, and a sheen follows the pointer across the face. On leave it
// settles back to its resting pose. A click, a tap, or Enter or Space while it
// has focus turns it over about its vertical axis to the back cover, spine
// toward the reader, and again to return; the runtime makes it a toggle
// button for that. Under prefers-reduced-motion only the toggle is attached,
// and the faces swap with no rotation.
//
// The runtime only writes unitless custom properties on the cover root (--rx,
// --ry, --lift, --gx, --gy, --turn); the stylesheet turns them into transforms
// and an opacity, so every frame is compositor work. While the book moves it
// carries .is-held, under which the stylesheet gives each layer its own
// compositing layer; at rest they are painted together. The resting pose is
// read from the stylesheet at mount, which keeps it in one place.

export const MAX_TURN = { x: 10, y: 18 }; // degrees at the edge of the cover
const EASE = 0.14; // share of the remaining distance covered per 60 Hz frame
export const TURN_MS = 820; // a half turn
const TURN_LIFT = 0.9; // the book rises as it turns over, and settles

type Pose = { rx: number; ry: number; lift: number; gx: number; gy: number };
const KEYS = ["rx", "ry", "lift", "gx", "gy"] as const;

// The pose for a pointer at (nx, ny), each in [-1, 1] across the cover: the
// face turns toward the pointer and the sheen sits under it, in percent.
export function poseAt(nx: number, ny: number, lift = 1): Pose {
  const x = Math.max(-1, Math.min(1, nx));
  const y = Math.max(-1, Math.min(1, ny));
  return { rx: -y * MAX_TURN.x, ry: x * MAX_TURN.y, lift, gx: (x + 1) * 50, gy: (y + 1) * 50 };
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

// What the runtime needs from the page, so tests can pass a stand-in.
export interface CoverEnv {
  matchMedia(query: string): { matches: boolean };
  requestAnimationFrame(cb: (t: number) => void): number;
  cancelAnimationFrame(id: number): void;
  getComputedStyle(el: Element): { getPropertyValue(name: string): string };
}

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

// Attach the tilt and the turn to a cover root ([data-cover]). Returns a
// function that detaches both and restores the rendered state.
export function mountCover(root: HTMLElement, env: CoverEnv = window as unknown as CoverEnv): () => void {
  const reduce = env.matchMedia(REDUCED_MOTION).matches;
  const img = { role: root.getAttribute("role"), label: root.getAttribute("aria-label") };
  root.setAttribute("role", "button");
  root.setAttribute("tabindex", "0");
  root.setAttribute("aria-label", root.getAttribute("data-turn-label") ?? "");
  root.setAttribute("aria-pressed", "false");
  root.classList.add("is-live");

  let back = false;
  let turn = 0; // degrees, 0 front, 180 back
  let turnFrom = 0, turnTo = 0, turnStart = -1, turnMs = 0;

  const cs = env.getComputedStyle(root);
  const num = (name: string) => { const v = parseFloat(cs.getPropertyValue(name)); return Number.isFinite(v) ? v : 0; };
  const rest: Pose = { rx: num("--rx"), ry: num("--ry"), lift: 0, gx: num("--gx"), gy: num("--gy") };
  const cur: Pose = { ...rest };
  let tgt: Pose = rest; // the same object, so a settled book is recognized as at rest
  let raf = 0;
  let last = 0;

  const write = (turnLift = 0) => {
    for (const k of KEYS) root.style.setProperty(`--${k}`, (k === "lift" ? cur.lift + turnLift : cur[k]).toFixed(3));
    root.style.setProperty("--turn", turn.toFixed(2));
  };

  const frame = (t: number) => {
    const dt = last ? Math.min(64, t - last) : 16.7;
    last = t;
    const k = 1 - Math.pow(1 - EASE, dt / 16.7);
    let moving = false;
    for (const key of KEYS) {
      const d = tgt[key] - cur[key];
      if (Math.abs(d) < 0.01) cur[key] = tgt[key];
      else { cur[key] += d * k; moving = true; }
    }
    let turnLift = 0;
    if (turn !== turnTo) {
      if (turnStart < 0) turnStart = t;
      const p = Math.min(1, (t - turnStart) / turnMs);
      const e = easeInOut(p);
      turn = p < 1 ? turnFrom + (turnTo - turnFrom) * e : turnTo;
      turnLift = TURN_LIFT * Math.sin(Math.PI * e);
      if (p < 1) moving = true;
    }
    write(turnLift);
    raf = moving ? env.requestAnimationFrame(frame) : 0;
    if (!moving) {
      last = 0;
      if (tgt === rest) root.classList.remove("is-held");
    }
  };
  const kick = () => { if (!raf) raf = env.requestAnimationFrame(frame); };
  const aim = (p: Pose) => {
    tgt = p;
    if (p !== rest) root.classList.add("is-held");
    kick();
  };

  const toggle = () => {
    back = !back;
    root.setAttribute("aria-pressed", String(back));
    const to = back ? 180 : 0;
    if (reduce) { turn = turnTo = to; root.style.setProperty("--turn", String(to)); return; }
    turnFrom = turn;
    turnTo = to;
    turnStart = -1;
    turnMs = (TURN_MS * Math.abs(to - turn)) / 180;
    root.classList.add("is-held");
    kick();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggle();
  };

  const at = (e: PointerEvent) => {
    const b = root.getBoundingClientRect();
    return poseAt(((e.clientX - b.left) / b.width) * 2 - 1, ((e.clientY - b.top) / b.height) * 2 - 1);
  };
  const onMove = (e: PointerEvent) => { if (e.pointerType !== "touch") aim(at(e)); };
  const onLeave = (e: PointerEvent) => { if (e.pointerType !== "touch") aim(rest); };

  root.addEventListener("click", toggle);
  root.addEventListener("keydown", onKey);
  if (!reduce) {
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
  }
  return () => {
    root.removeEventListener("click", toggle);
    root.removeEventListener("keydown", onKey);
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerleave", onLeave);
    root.classList.remove("is-held", "is-live");
    env.cancelAnimationFrame(raf);
    for (const k of [...KEYS, "turn"]) root.style.removeProperty(`--${k}`);
    for (const a of ["tabindex", "aria-pressed"]) root.removeAttribute(a);
    if (img.role) root.setAttribute("role", img.role);
    if (img.label) root.setAttribute("aria-label", img.label);
  };
}
