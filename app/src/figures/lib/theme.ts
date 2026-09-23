// Theme tokens for figures. Each value is a CSS var() reference to a custom
// property defined in theme.css under :root and redefined for the dark theme,
// so markup rendered at build time follows the reader's theme without script.
//
// Color by the job the color does:
//   ink, ink2, ink3   text and marks that are not data (primary, secondary, muted)
//   grid, rule        gridlines and axis baselines
//   paper, panel      the figure surface and a raised panel on it
//   c1..c8            categorical identity, assigned in this fixed order and
//                     never cycled (validated for CVD separation in both themes)
//   good, warn, bad   status, reserved for state and always paired with a label

export const C = {
  ink: "var(--fig-ink)",
  ink2: "var(--fig-ink-2)",
  ink3: "var(--fig-ink-3)",
  grid: "var(--fig-grid)",
  rule: "var(--fig-rule)",
  paper: "var(--fig-paper)",
  panel: "var(--fig-panel)",
  c1: "var(--fig-c1)", // blue
  c2: "var(--fig-c2)", // orange
  c3: "var(--fig-c3)", // aqua
  c4: "var(--fig-c4)", // yellow
  c5: "var(--fig-c5)", // magenta
  c6: "var(--fig-c6)", // green
  c7: "var(--fig-c7)", // violet
  c8: "var(--fig-c8)", // red
  good: "var(--fig-good)",
  warn: "var(--fig-warn)",
  bad: "var(--fig-bad)",
} as const;

export const CATEGORICAL = [C.c1, C.c2, C.c3, C.c4, C.c5, C.c6, C.c7, C.c8] as const;

// Type sizes in CSS pixels. The live figure renders at the column width, so a
// unit in the viewBox is one CSS pixel; 11 is the floor for any text a reader
// must read at 390 px.
export const TYPE = { small: 11, body: 12, label: 13, title: 14 } as const;
