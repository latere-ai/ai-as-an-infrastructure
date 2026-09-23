// Theme classes for Graphviz colors. Graphviz writes every color as a
// presentation attribute (fill="#f1ece1"), which cannot follow the reader's
// theme. After layout each fill and stroke gets a class naming the job the
// color does, and theme.css colors that class from the figure tokens, so light
// and dark both work for any color a source uses:
//
//   paper, panel         neutral surfaces: the page and a raised box on it
//   ink, ink2, ink3      neutral marks and text, darkest to lightest
//   c1..c8               a categorical hue as a solid mark
//   c1t..c8t             the same hue as a light tint (pastel fills)
//
// Neutral colors map by lightness; colored ones map to the categorical token
// nearest in hue. The hex attribute stays in place as the fallback for
// contexts without the reader's stylesheet.

export type Use = "fill" | "stroke" | "text";

// Hues of --fig-c1..c8 in the light theme (theme.css), in slot order.
export const CATEGORICAL_HEX = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

// SVG 1.1 color keywords, the names Graphviz writes into SVG output as-is.
const NAMED: Record<string, string> = Object.fromEntries(
  ("aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000 " +
    "blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 " +
    "chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b " +
    "darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b " +
    "darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a " +
    "darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 " +
    "darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff " +
    "firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 " +
    "goldenrod daa520 gray 808080 grey 808080 green 008000 greenyellow adff2f honeydew f0fff0 hotpink ff69b4 " +
    "indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 lawngreen 7cfc00 " +
    "lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff lightgoldenrodyellow fafad2 lightgray d3d3d3 " +
    "lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa " +
    "lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 " +
    "linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 " +
    "mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc " +
    "mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead " +
    "navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 " +
    "palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 " +
    "peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 red ff0000 rosybrown bc8f8f royalblue 4169e1 " +
    "saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 " +
    "skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 " +
    "tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff " +
    "whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32")
    .split(" ")
    .reduce<[string, string][]>((acc, w, k, all) => (k % 2 ? acc : [...acc, [w, `#${all[k + 1]}`]]), []),
);

function parse(value: string): [number, number, number] | null {
  let v = value.trim().toLowerCase();
  v = NAMED[v] ?? v;
  let m = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (m) return [m[1], m[2], m[3]].map((h) => parseInt(h + h, 16)) as [number, number, number];
  m = v.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/);
  if (m) return [m[1], m[2], m[3]].map((h) => parseInt(h, 16)) as [number, number, number];
  return null;
}

function hsl([r, g, b]: [number, number, number]): { h: number; l: number; chroma: number } {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const chroma = max - min;
  let h = 0;
  if (chroma > 0) {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    if (max === R) h = 60 * (((G - B) / chroma + 6) % 6);
    else if (max === G) h = 60 * ((B - R) / chroma + 2);
    else h = 60 * ((R - G) / chroma + 4);
  }
  return { h, l: (max + min) / 2, chroma };
}

const SLOT_HUES = CATEGORICAL_HEX.map((hex) => hsl(parse(hex)!).h);

// Warm off-whites such as the book's #f1ece1 box fill sit just under this
// chroma and read as neutral; the palest tints in use (#cfe8cf) sit above it.
const NEUTRAL_CHROMA = 0.095;

// The role a color plays, or null for none, transparent, and paint servers.
export function colorRole(value: string, use: Use): string | null {
  const rgb = parse(value);
  if (!rgb) return null;
  const { h, l, chroma } = hsl(rgb);
  if (chroma < NEUTRAL_CHROMA) {
    if (use === "text") return l < 0.22 ? "ink" : l < 0.52 ? "ink2" : l < 0.8 ? "ink3" : "paper";
    if (l >= 0.955) return "paper";
    if (l >= 0.8) return "panel";
    if (use === "fill") return l >= 0.45 ? "ink3" : l >= 0.22 ? "ink2" : "ink";
    return l >= 0.3 ? "ink3" : l >= 0.22 ? "ink2" : "ink";
  }
  let slot = 0;
  let best = 360;
  SLOT_HUES.forEach((sh, k) => {
    const d = Math.min(Math.abs(h - sh), 360 - Math.abs(h - sh));
    if (d < best) { best = d; slot = k; }
  });
  const tint = use !== "text" && l >= 0.75;
  return `c${slot + 1}${tint ? "t" : ""}`;
}

const SHAPE = /<(polygon|polyline|path|ellipse|circle|rect|line|text)\b([^>]*?)(\/?)>/g;
const attr = (attrs: string, name: string) => attrs.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

// Add a theme class to every painted shape and text run of a Graphviz SVG.
// SVG paints text and shapes without a fill attribute black, so those take the
// ink class.
export function themeClasses(svg: string): string {
  return svg.replace(SHAPE, (whole, tag: string, attrs: string, close: string) => {
    const classes: string[] = [];
    const fill = attr(attrs, "fill");
    const isText = tag === "text";
    const f = fill === undefined ? "ink" : colorRole(fill, isText ? "text" : "fill");
    if (f) classes.push(`dg-f-${f}`);
    const stroke = attr(attrs, "stroke");
    const s = !isText && stroke !== undefined ? colorRole(stroke, "stroke") : null;
    if (s) classes.push(`dg-s-${s}`);
    if (!classes.length) return whole;
    const existing = attr(attrs, "class");
    const merged = existing !== undefined
      ? attrs.replace(/\sclass="[^"]*"/, ` class="${existing} ${classes.join(" ")}"`)
      : `${attrs} class="${classes.join(" ")}"`;
    return `<${tag}${merged}${close}>`;
  });
}
