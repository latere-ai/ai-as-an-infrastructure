// The cover on the home page responds like a book picked up from a table: it
// turns toward the pointer, lifts a little, its layers shift against each
// other by depth, and a sheen follows the pointer across the face. On leave it
// settles back to its resting pose. A tap on a touch screen tips it toward the
// tap and lets it settle. Under prefers-reduced-motion nothing is attached and
// the cover stays as the build rendered it.
//
// The runtime only writes five unitless custom properties on the cover root
// (--rx, --ry, --lift, --gx, --gy); the stylesheet turns them into transforms
// and an opacity, so every frame is compositor work. While the cover moves it
// carries .is-held, under which the stylesheet gives each layer its own
// compositing layer; at rest they are painted together. The resting pose is
// read from the stylesheet at mount, which keeps it in one place.

export const MAX_TURN = { x: 10, y: 18 }; // degrees at the edge of the cover
const EASE = 0.14; // share of the remaining distance covered per 60 Hz frame
const TAP_HOLD_MS = 420;

type Pose = { rx: number; ry: number; lift: number; gx: number; gy: number };
const KEYS = ["rx", "ry", "lift", "gx", "gy"] as const;

// The pose for a pointer at (nx, ny), each in [-1, 1] across the cover: the
// face turns toward the pointer and the sheen sits under it, in percent.
export function poseAt(nx: number, ny: number, lift = 1): Pose {
  const x = Math.max(-1, Math.min(1, nx));
  const y = Math.max(-1, Math.min(1, ny));
  return { rx: -y * MAX_TURN.x, ry: x * MAX_TURN.y, lift, gx: (x + 1) * 50, gy: (y + 1) * 50 };
}

// What the runtime needs from the page, so tests can pass a stand-in.
export interface CoverEnv {
  matchMedia(query: string): { matches: boolean };
  requestAnimationFrame(cb: (t: number) => void): number;
  cancelAnimationFrame(id: number): void;
  getComputedStyle(el: Element): { getPropertyValue(name: string): string };
  setTimeout(cb: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

// Attach the tilt to a cover root ([data-cover]). Returns a function that
// detaches it and restores the resting pose.
export function mountCover(root: HTMLElement, env: CoverEnv = window as unknown as CoverEnv): () => void {
  if (env.matchMedia(REDUCED_MOTION).matches) return () => {};

  const cs = env.getComputedStyle(root);
  const num = (name: string) => { const v = parseFloat(cs.getPropertyValue(name)); return Number.isFinite(v) ? v : 0; };
  const rest: Pose = { rx: num("--rx"), ry: num("--ry"), lift: 0, gx: num("--gx"), gy: num("--gy") };
  const cur: Pose = { ...rest };
  let tgt: Pose = { ...rest };
  let raf = 0;
  let last = 0;
  let tap = 0;

  const write = () => { for (const k of KEYS) root.style.setProperty(`--${k}`, cur[k].toFixed(3)); };

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
    write();
    raf = moving ? env.requestAnimationFrame(frame) : 0;
    if (!moving) {
      last = 0;
      if (tgt === rest) root.classList.remove("is-held");
    }
  };
  const aim = (p: Pose) => {
    tgt = p;
    if (p !== rest) root.classList.add("is-held");
    if (!raf) raf = env.requestAnimationFrame(frame);
  };

  const at = (e: PointerEvent, lift?: number) => {
    const b = root.getBoundingClientRect();
    return poseAt(((e.clientX - b.left) / b.width) * 2 - 1, ((e.clientY - b.top) / b.height) * 2 - 1, lift);
  };
  const onMove = (e: PointerEvent) => { if (e.pointerType !== "touch") aim(at(e)); };
  const onLeave = (e: PointerEvent) => { if (e.pointerType !== "touch") aim(rest); };
  // A tap tips the book toward the finger, then lets it settle. The page keeps
  // scrolling: nothing here prevents the default.
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    aim(at(e, 0.6));
    env.clearTimeout(tap);
    tap = env.setTimeout(() => aim(rest), TAP_HOLD_MS);
  };

  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerleave", onLeave);
  root.addEventListener("pointerdown", onDown);
  return () => {
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerleave", onLeave);
    root.removeEventListener("pointerdown", onDown);
    root.classList.remove("is-held");
    env.cancelAnimationFrame(raf);
    env.clearTimeout(tap);
    for (const k of KEYS) root.style.removeProperty(`--${k}`);
  };
}
