/** Qualitative lane/status palette from the design handoff — kept in the same
 * muted register as the mono-accent Industry system, but distinguishable
 * enough to tell git branches apart at a glance. Indexed by lane, so it stays
 * a JS lookup rather than a fixed set of CSS classes; theme-scoped, non-lane
 * colors (select background, dirty/neutral tags) live as CSS custom
 * properties in tokens.css instead. */
export type Theme = "light" | "dark";

export interface LaneColor {
  stroke: string;
  bg: string;
  text: string;
}

export const QUAL_LIGHT: LaneColor[] = [
  { stroke: "#5980a6", bg: "#eaf1f7", text: "#33506b" },
  { stroke: "#6f8f5a", bg: "#eef3ea", text: "#445c37" },
  { stroke: "#a67a4f", bg: "#f5eee7", text: "#6b4d30" },
  { stroke: "#8a6a94", bg: "#efe9f1", text: "#5a4560" },
  { stroke: "#4f9a94", bg: "#e8f3f2", text: "#33635f" },
  { stroke: "#a15f6a", bg: "#f5eaec", text: "#693e45" },
];

export const QUAL_DARK: LaneColor[] = [
  { stroke: "#8fb8d9", bg: "rgba(89,128,166,.18)", text: "#bcd9f5" },
  { stroke: "#9dc17f", bg: "rgba(111,143,90,.18)", text: "#cfe3bd" },
  { stroke: "#d1a06e", bg: "rgba(166,122,79,.18)", text: "#f0d3b0" },
  { stroke: "#c39fce", bg: "rgba(138,106,148,.18)", text: "#e8d3ee" },
  { stroke: "#7ecac3", bg: "rgba(79,154,148,.18)", text: "#bdeae6" },
  { stroke: "#d0919b", bg: "rgba(161,95,106,.18)", text: "#f0c7cd" },
];

export function getPalette(theme: Theme): LaneColor[] {
  return theme === "dark" ? QUAL_DARK : QUAL_LIGHT;
}
