import { useEffect, useState } from "react";
import { useApp } from "paintcannon-react";

// Dim a `#rrggbb` color toward black by `factor` (0 = unchanged, 1 = black).
export function dim(color: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(color);
  if (m === null) return color;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const f = 1 - Math.max(0, Math.min(1, factor));
  const dr = Math.round(r * f);
  const dg = Math.round(g * f);
  const db = Math.round(b * f);
  return `#${((dr << 16) | (dg << 8) | db).toString(16).padStart(6, "0")}`;
}

// Terminal focus detection via paintcannon's app-level focus/blur events,
// which are separate from element focus. Seeded from the current focus state
// so the first paint matches reality.
export function useFocus(): boolean {
  const app = useApp();
  const [focused, setFocused] = useState(app.paintCannon.hasFocus);
  useEffect(() => {
    const pc = app.paintCannon;
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    pc.addEventListener("focus", onFocus);
    pc.addEventListener("blur", onBlur);
    return () => {
      pc.removeEventListener("focus", onFocus);
      pc.removeEventListener("blur", onBlur);
    };
  }, [app]);
  return focused;
}

// Base (focused) colors. When the terminal is unfocused, every color is dimmed
// toward black via `dim()` so the whole UI reads as inactive.
const DIM_FACTOR = 0.4;

const BASE = {
  bg: "#020617",
  fg: "#e2e8f0",
  headerBg: "#1e293b",
  barBg: "#1e293b",
  barKey: "#e2e8f0",
  barLabel: "#64748b",
  rowEven: "#0f172a",
  rowOdd: "#020617",
  rowSelected: "#334155",
  detailKey: "#94a3b8",
  prompt: "#38bdf8",
  completion: "#fb923c",
  cacheRead: "#4ade80",
  alias: "#facc15",
  scrollbarThumb: "#1e293b",
  scrollbarTrack: "#020617",
} as const;

export function makePalette(focused: boolean) {
  const dimWhenUnfocused = (color: string): string =>
    focused ? color : dim(color, DIM_FACTOR);
  return {
    bg: dimWhenUnfocused(BASE.bg),
    fg: dimWhenUnfocused(BASE.fg),
    headerBg: dimWhenUnfocused(BASE.headerBg),
    barBg: dimWhenUnfocused(BASE.barBg),
    barKey: dimWhenUnfocused(BASE.barKey),
    barLabel: dimWhenUnfocused(BASE.barLabel),
    rowEven: dimWhenUnfocused(BASE.rowEven),
    rowOdd: dimWhenUnfocused(BASE.rowOdd),
    rowSelected: dimWhenUnfocused(BASE.rowSelected),
    detailKey: dimWhenUnfocused(BASE.detailKey),
    prompt: dimWhenUnfocused(BASE.prompt),
    completion: dimWhenUnfocused(BASE.completion),
    cacheRead: dimWhenUnfocused(BASE.cacheRead),
    alias: dimWhenUnfocused(BASE.alias),
    scrollbarThumb: dimWhenUnfocused(BASE.scrollbarThumb),
    scrollbarTrack: dimWhenUnfocused(BASE.scrollbarTrack),
  };
}

export type Palette = ReturnType<typeof makePalette>;
