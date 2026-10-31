export type ThemePackId =
  | "classic"
  | "halloween"
  | "christmas"
  | "newyear"
  | "minimal"
  | "cute"
  | "abstract"
  | "tech"
  | "nature";

export interface ThemePackMeta {
  id: ThemePackId;
  label: string;
  description: string;
  /** Preview dots: primary, accent, secondary, background */
  swatches: string[];
}

export const THEME_PACKS: ThemePackMeta[] = [
  {
    id: "classic",
    label: "Classic Editorial",
    description: "The default look — porcelain, teal and lilac.",
    swatches: ["#17798a", "#7c6cf0", "#2aa076", "#f4f8fa"],
  },
  {
    id: "halloween",
    label: "Halloween",
    description: "Pumpkin orange, plum and parchment.",
    swatches: ["#e66a1f", "#6d4aa8", "#5a7a3f", "#f7efe2"],
  },
  {
    id: "christmas",
    label: "Christmas",
    description: "Fir green, berry red and a touch of gold.",
    swatches: ["#1e7a4a", "#c6283c", "#d9a52a", "#f2f7f6"],
  },
  {
    id: "newyear",
    label: "New Year",
    description: "Midnight navy, champagne gold and fireworks.",
    swatches: ["#2b3a8f", "#d9a52a", "#d45087", "#f2f4fb"],
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Quiet greys with a single charcoal accent.",
    swatches: ["#2f3237", "#8a8f99", "#5b6068", "#f7f8f9"],
  },
  {
    id: "cute",
    label: "Cute Pastel",
    description: "Soft pink, lavender and mint.",
    swatches: ["#ef7fae", "#b18ff2", "#8fcfae", "#fdf1f6"],
  },
  {
    id: "abstract",
    label: "Abstract",
    description: "Bold indigo, coral and lime.",
    swatches: ["#4f46e5", "#f0653f", "#a3c93a", "#f3f4fa"],
  },
  {
    id: "tech",
    label: "Tech / AI",
    description: "Neon cyan and violet on cool surfaces.",
    swatches: ["#17c3e6", "#7b5cf0", "#17c3e6", "#f0f8fb"],
  },
  {
    id: "nature",
    label: "Nature",
    description: "Forest greens with a sky-blue accent.",
    swatches: ["#2f7a4f", "#4a9bd1", "#7fa650", "#f4f8f1"],
  },
];

const PACK_IDS = new Set(THEME_PACKS.map((pack) => pack.id));

export function isThemePackId(value: string | null | undefined): value is ThemePackId {
  return !!value && PACK_IDS.has(value as ThemePackId);
}
