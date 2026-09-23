// The shared motion primitive: a timeline position driven by
// requestAnimationFrame, with play, pause, step, and scrub controls.
//
// The figure never animates itself. It declares a timeline (duration, rate,
// keyframes, poster) and renders a pure function of the position; this
// controller owns time. Under prefers-reduced-motion nothing plays: the play
// button is not offered and the step buttons move between keyframes, so a
// reader still reaches every named moment without motion. The scrubber works
// in both modes, since dragging it is the reader's own motion.
//
// Keyboard: the scrubber takes arrow keys, Page Up/Down, Home, and End
// natively; the buttons are native buttons. Space on a transport button
// toggles play as a button press does.

import type { Keyframe, Lang } from "../types.ts";

export interface TransportOptions {
  lang: Lang;
  duration: number;
  rate: number; // positions per second
  discrete: boolean;
  keyframes: Keyframe[];
  reduced: boolean;
  t: number;
  onSeek(t: number, cause: "play" | "user"): void;
}

const TEXT = {
  en: { play: "Play", pause: "Pause", back: "Step back", fwd: "Step forward", prevKey: "Previous event", nextKey: "Next event", scrub: "Timeline position", pos: "step {t} of {d}", reduced: "Reduced motion: the step buttons move between events." },
  zh: { play: "播放", pause: "暂停", back: "后退一步", fwd: "前进一步", prevKey: "上一个事件", nextKey: "下一个事件", scrub: "时间轴位置", pos: "第 {t} 步 / 共 {d} 步", reduced: "已减少动态效果：步进按钮在事件之间跳转。" },
};

const ICON = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h2v11H3zM13 2.5v11L6 8z" fill="currentColor"/></svg>',
  fwd: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2.5h2v11h-2zM3 2.5v11L10 8z" fill="currentColor"/></svg>',
};

export class Transport {
  readonly root: HTMLElement;
  t: number;
  private o: TransportOptions;
  private playing = false;
  private raf = 0;
  private last = 0;
  private playBtn?: HTMLButtonElement;
  private scrub: HTMLInputElement;
  private pos: HTMLElement;
  private event: HTMLElement;
  private ticks: HTMLElement;

  constructor(o: TransportOptions) {
    this.o = o;
    this.t = o.t;
    const L = TEXT[o.lang];
    this.root = document.createElement("div");
    this.root.className = "fig-transport";
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", L.scrub);
    const btn = (icon: string, label: string, on: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fig-btn";
      b.innerHTML = icon;
      b.setAttribute("aria-label", label);
      b.title = label;
      b.addEventListener("click", on);
      return b;
    };
    const buttons = document.createElement("div");
    buttons.className = "fig-transport-buttons";
    if (!o.reduced) {
      this.playBtn = btn(ICON.play, L.play, () => (this.playing ? this.pause() : this.play()));
      buttons.append(this.playBtn,
        btn(ICON.back, L.back, () => this.step(-1)),
        btn(ICON.fwd, L.fwd, () => this.step(1)));
    } else {
      buttons.append(btn(ICON.back, L.prevKey, () => this.jumpKey(-1)), btn(ICON.fwd, L.nextKey, () => this.jumpKey(1)));
      buttons.title = L.reduced;
    }
    const track = document.createElement("div");
    track.className = "fig-scrub";
    this.scrub = document.createElement("input");
    this.scrub.type = "range";
    this.scrub.min = "0";
    this.scrub.step = o.discrete ? "1" : "any";
    this.scrub.setAttribute("aria-label", L.scrub);
    this.scrub.addEventListener("input", () => { this.pause(); this.seek(Number(this.scrub.value), "user"); });
    this.ticks = document.createElement("div");
    this.ticks.className = "fig-scrub-ticks";
    this.ticks.setAttribute("aria-hidden", "true");
    track.append(this.scrub, this.ticks);
    this.pos = document.createElement("span");
    this.pos.className = "fig-transport-pos";
    this.event = document.createElement("div");
    this.event.className = "fig-transport-event";
    const row = document.createElement("div");
    row.className = "fig-transport-row";
    row.append(buttons, track, this.pos);
    this.root.append(row, this.event);
    this.configure(o.duration, o.keyframes);
  }

  // New duration or keyframes after a parameter change; keeps the position.
  configure(duration: number, keyframes: Keyframe[]) {
    this.o.duration = duration;
    this.o.keyframes = keyframes;
    this.scrub.max = String(duration);
    this.ticks.innerHTML = "";
    const seen = new Set<number>();
    for (const k of keyframes) {
      if (seen.has(k.t)) continue;
      seen.add(k.t);
      const i = document.createElement("i");
      i.style.left = `${(k.t / Math.max(1, duration)) * 100}%`;
      this.ticks.append(i);
    }
    this.t = Math.min(this.t, duration);
    this.paint();
  }

  get isPlaying() { return this.playing; }

  play() {
    if (this.o.reduced || this.playing) return;
    if (this.t >= this.o.duration) this.t = 0;
    this.playing = true;
    this.last = 0;
    this.paintButton();
    const tick = (now: number) => {
      if (!this.playing) return;
      if (!this.root.isConnected) { this.pause(); return; }
      if (this.last) {
        const next = Math.min(this.o.duration, this.t + ((now - this.last) / 1000) * this.o.rate);
        this.seek(next, "play");
        if (next >= this.o.duration) { this.pause(); return; }
      }
      this.last = now;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.paintButton();
    this.o.onSeek(this.shown(), "user"); // announce where playback stopped
  }

  step(dir: -1 | 1) {
    this.pause();
    const d = this.o.discrete ? 1 : this.o.duration / 100;
    this.seek(Math.max(0, Math.min(this.o.duration, Math.round((this.t + dir * d) * 1000) / 1000)), "user");
  }

  jumpKey(dir: -1 | 1) {
    this.pause();
    const ts = [...new Set(this.o.keyframes.map((k) => k.t))].sort((a, b) => a - b);
    const cur = this.shown();
    const next = dir > 0 ? ts.find((t) => t > cur) : [...ts].reverse().find((t) => t < cur);
    if (next != null) this.seek(next, "user");
  }

  seek(t: number, cause: "play" | "user") {
    const before = this.shown();
    this.t = t;
    this.paint();
    if (cause === "user" || this.shown() !== before) this.o.onSeek(this.shown(), cause);
  }

  // The position the figure renders: integer for discrete timelines.
  shown(): number {
    return this.o.discrete ? Math.floor(this.t + 1e-9) : this.t;
  }

  // The latest keyframe at or before the shown position; keyframes that share
  // a position are merged into one label.
  currentKey(): Keyframe | undefined {
    const t = this.shown();
    let at = -1;
    for (const k of this.o.keyframes) if (k.t <= t && k.t > at) at = k.t;
    if (at < 0) return undefined;
    const sep = this.o.lang === "zh" ? "；" : "; ";
    return { t: at, label: this.o.keyframes.filter((k) => k.t === at).map((k) => k.label).join(sep) };
  }

  private paint() {
    const L = TEXT[this.o.lang];
    const t = this.shown();
    this.scrub.value = String(t);
    const posText = L.pos.replace("{t}", String(Math.round(t))).replace("{d}", String(Math.round(this.o.duration)));
    this.pos.textContent = posText;
    this.scrub.setAttribute("aria-valuetext", posText);
    const k = this.currentKey();
    const fresh = k && t - k.t <= 6;
    this.event.textContent = k ? (this.o.lang === "zh" ? `第 ${k.t} 步：${k.label}` : `Step ${k.t}: ${k.label}`) : "";
    this.event.classList.toggle("is-stale", !fresh);
  }

  private paintButton() {
    if (!this.playBtn) return;
    const L = TEXT[this.o.lang];
    this.playBtn.innerHTML = this.playing ? ICON.pause : ICON.play;
    this.playBtn.setAttribute("aria-label", this.playing ? L.pause : L.play);
    this.playBtn.title = this.playing ? L.pause : L.play;
  }
}
