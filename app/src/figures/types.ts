// The figure module contract. A figure is one TypeScript module that declares
// its parameters, its optional timeline, its en/zh labels, and a pure render
// function from state to SVG markup. The same module renders the static
// fallback at build time (Bun) and the live figure in the browser, so render
// must not touch the DOM, the clock, or Math.random.

export type Lang = "en" | "zh";

// A string in both book languages.
export interface Text { en: string; zh: string }

// A named point on a range control (for example "√d_h = 8" on a divisor).
export interface Mark { value: number; label: Text }

export interface RangeParam {
  kind: "range";
  label: Text;
  min: number;
  max: number;
  default: number;
  step?: number; // linear step; log ranges move in 1/100 of a decade
  scale?: "linear" | "log";
  unit?: Text; // shown after the value in the control readout
  marks?: Mark[];
  control?: boolean; // false: settable from the chapter block, no on-page control
}

export interface ChoiceParam<V extends string | number = string | number> {
  kind: "choice";
  label: Text;
  options: ReadonlyArray<{ value: V; label: Text }>;
  default: V;
  // Segmented buttons up to four options, a select beyond; "buttons" keeps a
  // longer list as a wrapping row (for example, the tokens of a sentence).
  control?: boolean | "buttons" | "select";
}

export interface ToggleParam {
  kind: "toggle";
  label: Text;
  default: boolean;
  control?: boolean;
}

export type ParamSpec = RangeParam | ChoiceParam | ToggleParam;
export type ParamSpecs = Record<string, ParamSpec>;

// The value type each declaration produces.
export type ParamValue<S> = S extends RangeParam ? number
  : S extends ToggleParam ? boolean
  : S extends ChoiceParam<infer V> ? V
  : never;
export type Params<D extends ParamSpecs> = { -readonly [K in keyof D]: ParamValue<D[K]> };

// What render sees. `t` is the timeline position (0 for a figure without a
// timeline); `w` is the layout width in CSS pixels, so a figure can change its
// composition for a phone column; `uid` namespaces SVG ids (patterns, clip
// paths) because a page can hold several renders of the same figure.
export interface State<P> {
  p: P;
  t: number;
  w: number;
  uid: string;
}

export interface Keyframe { t: number; label: string }

// The unit of a timeline in physical time, for the transport's position
// readout: "t = 2.48 s" where a step count would read "step 2483 of 2483".
export interface TimelineUnit<P> {
  // Unit after the number, per language ("s" / "秒", "h" / "小时"); empty when
  // `value` writes its own units (a log-time axis read as "3 min 20 s").
  symbol: Text;
  // The number for position t, written as the figure's own axis or cursor
  // writes it. Default: t to three significant figures.
  value?(t: number, p: P, lang: Lang): string;
}

export interface Timeline<P> {
  // Last timeline position. Positions run from 0 to duration.
  duration(p: P): number;
  // Positions per second at 1x playback.
  rate: number;
  // Snap positions to integers (a figure whose state changes in steps).
  discrete?: boolean;
  // Positions in physical time: the transport reads "t = 14 ms". Without a
  // unit it counts steps ("step 3 of 12").
  unit?: TimelineUnit<P>;
  // Named moments. Reduced-motion readers step between these; the scrubber
  // marks them; the live region announces them.
  keyframes(p: P, lang: Lang): Keyframe[];
  // The position the page opens on and the build renders: the most
  // informative moment, not an empty t = 0.
  poster(p: P): number;
}

export interface Figure<D extends ParamSpecs = ParamSpecs, L extends Record<string, string> = Record<string, string>> {
  name: string; // kebab-case, equal to the module file name
  title: Text; // accessible name of the figure group
  params: D;
  labels: { en: L; zh: L };
  timeline?: Timeline<Params<D>>;
  // Pure: SVG markup with a viewBox and no fixed pixel width.
  render(s: State<Params<D>>, lang: Lang): string;
  // Plain-text summary of the current state: the SVG's accessible name and
  // what the live region announces after a change.
  describe(s: State<Params<D>>, lang: Lang): string;
  // Optional: adjust dependent parameters after the reader changes `key`
  // (for example, choosing an example operation moves the intensity slider).
  update?(p: Params<D>, key: keyof D & string): Params<D>;
}

// Identity helper that infers the parameter types from the declaration and the
// label keys from `labels.en`, so render receives typed params and the zh table
// must carry exactly the en keys (a missing or extra zh label is a type error).
export function defineFigure<const D extends ParamSpecs, L extends Record<string, string>>(
  f: Omit<Figure<D, L>, "labels"> & { labels: { en: L; zh: NoInfer<L> } },
): Figure<D, L> {
  return f;
}

// Any figure, for registries and the runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFigure = Figure<any, any>;
