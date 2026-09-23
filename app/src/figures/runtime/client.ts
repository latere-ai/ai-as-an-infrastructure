// Hydration: turn each static figure host into a live figure. The host
// already holds the build-time SVG; this adds the controls and the transport,
// re-renders at the measured column width, and re-renders on every parameter
// or timeline change. Idempotent: the reader calls it after every hydration.
//
// Pointer shortcuts: any SVG element with data-fig-set="key=value" sets that
// parameter on click (for example, clicking a request row selects it). Every
// such parameter also has a keyboard path through a control or is a
// convenience over one.
//
// host.__fig exposes { params, t, set, seek, play, pause } for tests,
// screenshots, and debugging.

import { LOADERS } from "../loaders.ts";
import type { AnyFigure, Lang } from "../types.ts";
import { coerce, defaults, type ParamRecord } from "../lib/params.ts";
import { buildControls } from "./controls.ts";
import { Transport } from "./transport.ts";

interface FigHandle {
  params: ParamRecord;
  t: number;
  set(key: string, value: number | string | boolean): void;
  seek(t: number): void;
  play(): void;
  pause(): void;
}

declare global {
  interface HTMLElement { __fig?: FigHandle }
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function mount(host: HTMLElement, fig: AnyFigure) {
  const lang: Lang = host.dataset.lang === "zh" ? "zh" : "en";
  let p: ParamRecord = { ...defaults(fig), ...JSON.parse(host.dataset.params || "{}") };
  const tl = fig.timeline;
  const uid = `${host.closest("figure")?.id || fig.name}-live`;

  const stage = document.createElement("div");
  stage.className = "fig-stage";
  const live = document.createElement("div");
  live.className = "fig-sr";
  live.setAttribute("aria-live", "polite");

  let t = 0;
  let width = 0;
  let announceTimer = 0;
  const announce = (extra = "") => {
    clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      live.textContent = [extra, fig.describe({ p, t, w: width, uid }, lang)].filter(Boolean).join(" ");
    }, 350);
  };

  const draw = () => {
    width = Math.max(240, Math.floor(stage.clientWidth || host.clientWidth || 620));
    stage.innerHTML = fig.render({ p, t, w: width, uid }, lang);
  };

  let transport: Transport | undefined;
  const set = (key: string, value: number | string | boolean) => {
    p = { ...p, [key]: coerce(fig, key, value) };
    if (fig.update) p = fig.update(p, key);
    controls.sync(p);
    if (tl && transport) {
      transport.configure(tl.duration(p), tl.keyframes(p, lang));
      t = transport.shown();
    }
    draw();
    announce();
  };

  const controls = buildControls(fig, lang, p, set);
  host.classList.add("fig-ready");
  host.setAttribute("role", "group");
  host.setAttribute("aria-label", fig.title[lang]);
  const parts: HTMLElement[] = [];
  if (controls.root.childElementCount) parts.push(controls.root);

  if (tl) {
    const reduced = reducedMotion();
    const t0 = host.dataset.t != null && host.dataset.t !== "" ? Number(host.dataset.t) : tl.poster(p);
    transport = new Transport({
      lang, reduced, rate: tl.rate, discrete: tl.discrete ?? true,
      duration: tl.duration(p), keyframes: tl.keyframes(p, lang), t: Math.min(t0, tl.duration(p)),
      onSeek: (nt, cause) => {
        t = nt;
        draw();
        if (cause === "user") announce(transport!.currentKey()?.t === nt ? transport!.currentKey()!.label : "");
      },
    });
    t = transport.shown();
    parts.push(transport.root);
    // Pause when the figure scrolls out of view.
    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver((entries) => {
        for (const e of entries) if (!e.isIntersecting && transport!.isPlaying) transport!.pause();
      }).observe(host);
    }
  }

  parts.push(stage, live);
  host.querySelector(".fig-static")?.remove();
  host.append(...parts);
  draw();

  stage.addEventListener("click", (ev) => {
    const target = (ev.target as Element).closest?.("[data-fig-set]");
    if (!target) return;
    const [key, value] = (target.getAttribute("data-fig-set") ?? "").split("=");
    if (key && value != null && key in fig.params) set(key, value);
  });

  // Re-lay out when the column width changes (rotation, sidebar, window).
  if (typeof ResizeObserver === "function") {
    let raf = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (Math.floor(stage.clientWidth) !== width) draw();
      });
    }).observe(stage);
  }

  host.__fig = {
    get params() { return { ...p }; },
    get t() { return t; },
    set,
    seek: (nt: number) => transport?.seek(nt, "user"),
    play: () => transport?.play(),
    pause: () => transport?.pause(),
  } as FigHandle;
}

// Load each embedded figure's module once, then mount every host that uses
// it. Until the module arrives, and if it fails, the static SVG stays visible.
export function mountFigures() {
  const hosts = [...document.querySelectorAll<HTMLElement>(".fig[data-figure]:not(.fig-ready):not(.fig-loading)")];
  for (const host of hosts) {
    const name = host.dataset.figure ?? "";
    const load = LOADERS[name];
    if (!load) { host.dataset.figError = "unknown figure"; continue; }
    host.classList.add("fig-loading");
    load().then(({ default: fig }) => {
      host.classList.remove("fig-loading");
      if (!host.isConnected) return;
      try { mount(host, fig); } catch (e) {
        // Keep the static figure visible; record the failure for diagnosis.
        host.dataset.figError = String((e as Error).message ?? e);
        console.error(`figure ${name}:`, e);
      }
    }).catch((e: unknown) => {
      host.classList.remove("fig-loading");
      host.dataset.figError = String((e as Error)?.message ?? e);
      console.error(`figure ${name}:`, e);
    });
  }
}
