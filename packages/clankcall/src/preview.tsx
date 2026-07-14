import { useEffect, useRef, useState } from "react";
import { Div, Input, Span, useApp } from "paintcannon-react";
import type { DivElement } from "paintcannon";
import type { Model } from "./models.ts";

// Dim a `#rrggbb` color toward black by `factor` (0 = unchanged, 1 = black).
function dim(color: string, factor: number): string {
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
function useFocus(): boolean {
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

function formatPrice(price: string | undefined): string {
  if (price === undefined) return "—";
  const n = Number(price.replace(/^\$/, ""));
  if (!Number.isFinite(n) || n === 0) return "—";
  // OpenRouter prices are per token; show per 1M tokens for readability.
  return `${(n * 1_000_000).toFixed(2)}/M`;
}

function formatContext(length: number | undefined): string {
  if (length === undefined) return "—";
  return `${(length / 1000).toFixed(0)}k`;
}

function columnWidth(header: string, values: string[]): number {
  return values.reduce((longest, value) => Math.max(longest, value.length), header.length);
}

function truncate(value: string, width: number): string {
  if (value.length <= width) return value;
  if (width <= 1) return "…";
  return `${value.slice(0, width - 1)}…`;
}

// Scroll offset (in terminal rows) that keeps `index` visible within a window
// of `visibleRows` rows, only moving when the selection would scroll off.
function keepVisible(index: number, scrollTop: number, visibleRows: number): number {
  if (visibleRows <= 0) return 0;
  if (index < scrollTop) return index;
  if (index >= scrollTop + visibleRows) return index - visibleRows + 1;
  return scrollTop;
}

// Word-wrap text to fit within `width` terminal columns, breaking on word
// boundaries and hard-breaking tokens longer than the width.
function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [""];
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line === "") {
      line = word;
    } else if (line.length + 1 + word.length <= width) {
      line += " " + word;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  // Hard-break any line still longer than the available width.
  const result: string[] = [];
  for (const l of lines) {
    let remaining = l;
    while (remaining.length > width) {
      result.push(remaining.slice(0, width));
      remaining = remaining.slice(width);
    }
    result.push(remaining);
  }
  return result;
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
  scrollbarThumb: "#1e293b",
  scrollbarTrack: "#020617",
} as const;

function makePalette(focused: boolean) {
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
    scrollbarThumb: dimWhenUnfocused(BASE.scrollbarThumb),
    scrollbarTrack: dimWhenUnfocused(BASE.scrollbarTrack),
  };
}

type Palette = ReturnType<typeof makePalette>;

interface DetailRow {
  key: string;
  value: string;
  color?: string;
}

// Flatten a model into ordered key/value pairs, following the field order
// declared in models.ts. Nested objects use dotted keys; arrays of objects
// are indexed. Optional fields are only included when present. Accent colors
// are resolved from the palette so they dim together with the rest of the UI.
function modelDetails(model: Model, palette: Palette): DetailRow[] {
  const rows: DetailRow[] = [
    { key: "id", value: model.id },
    { key: "name", value: model.name ?? "—" },
    { key: "created", value: model.created !== undefined ? String(model.created) : "—" },
    { key: "input_modalities", value: model.input_modalities?.join(", ") ?? "—" },
    { key: "output_modalities", value: model.output_modalities?.join(", ") ?? "—" },
    { key: "context_length", value: formatContext(model.context_length) },
    { key: "max_output_length", value: formatContext(model.max_output_length) },
    { key: "pricing.prompt", value: formatPrice(model.pricing?.prompt), color: palette.prompt },
    { key: "pricing.completion", value: formatPrice(model.pricing?.completion), color: palette.completion },
  ];
  if (model.pricing !== undefined) {
    if (model.pricing.image !== undefined) {
      rows.push({ key: "pricing.image", value: formatPrice(model.pricing.image) });
    }
    if (model.pricing.request !== undefined) {
      rows.push({ key: "pricing.request", value: formatPrice(model.pricing.request) });
    }
    if (model.pricing.input_cache_read !== undefined) {
      rows.push({ key: "pricing.input_cache_read", value: formatPrice(model.pricing.input_cache_read) });
    }
  }
  rows.push(
    { key: "supported_sampling_parameters", value: model.supported_sampling_parameters?.join(", ") ?? "—" },
    { key: "supported_features", value: model.supported_features?.join(", ") ?? "—" },
  );
  if (model.hugging_face_id !== undefined) {
    rows.push({ key: "hugging_face_id", value: model.hugging_face_id });
  }
  if (model.quantization !== undefined) {
    rows.push({ key: "quantization", value: model.quantization });
  }
  if (model.description !== undefined) {
    rows.push({ key: "description", value: model.description });
  }
  if (model.deprecation_date !== undefined) {
    rows.push({ key: "deprecation_date", value: model.deprecation_date });
  }
  if (model.is_ready !== undefined) {
    rows.push({ key: "is_ready", value: String(model.is_ready) });
  }
  if (model.discount_to_user !== undefined) {
    rows.push({ key: "discount_to_user", value: String(model.discount_to_user) });
  }
  if (model.openrouter !== undefined) {
    rows.push({ key: "openrouter.slug", value: model.openrouter.slug });
  }
  if (model.datacenters !== undefined) {
    model.datacenters.forEach((dc, i) => {
      rows.push({ key: `datacenters[${i}].country_code`, value: dc.country_code });
    });
  }
  return rows;
}

const HEADERS = ["Name", "Context", "Prompt", "Completion"];
const GAP = 2;

interface Hint {
  keys: string;
  label: string;
}

const LIST_HINTS: Hint[] = [
  { keys: "↑/↓", label: "select" },
  { keys: "enter", label: "details" },
  { keys: "ctrl-c", label: "quit" },
];

const DETAILS_HINTS: Hint[] = [
  { keys: "esc", label: "back" },
  { keys: "↑/↓ j/k", label: "scroll" },
  { keys: "ctrl-c", label: "quit" },
];

function cellStyle(width: number, color?: string, bold?: boolean) {
  return {
    width,
    flexShrink: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    ...(color ? { color } : {}),
    ...(bold ? { fontWeight: "bold" as const } : {}),
  };
}

function cellText(value: string, contentWidth: number, isLast: boolean): string {
  const width = contentWidth + (isLast ? 0 : GAP);
  return truncate(value, contentWidth).padEnd(width, " ");
}

function StatusBar({ hints, palette }: { hints: Hint[]; palette: Palette }) {
  return (
    <Div
      style={{
        display: "flex",
        flexDirection: "row",
        backgroundColor: palette.barBg,
        padding: "0 1",
      }}
    >
      {hints.map((hint, i) => (
        <Div key={i} style={{ display: "flex", flexDirection: "row" }}>
          {i > 0 && <Span style={{ color: palette.barLabel }}>{"  ·  "}</Span>}
          <Span style={{ color: palette.barKey, fontWeight: "bold" }}>{hint.keys}</Span>
          <Span style={{ color: palette.barLabel }}>{` ${hint.label}`}</Span>
        </Div>
      ))}
    </Div>
  );
}

function ModelRow({
  widths,
  values,
  even,
  selected,
  palette,
}: {
  widths: number[];
  values: string[];
  even: boolean;
  selected: boolean;
  palette: Palette;
}) {
  // Per-column text color; indexed to match the column order in HEADERS. The
  // Prompt/Completion accents come from the palette so they dim when unfocused.
  const columnColors = [undefined, undefined, palette.prompt, palette.completion];
  return (
    <Div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        backgroundColor: selected
          ? palette.rowSelected
          : even
            ? palette.rowEven
            : palette.rowOdd,
      }}
    >
      {values.map((value, i) => {
        const isLast = i === values.length - 1;
        return (
          <Span
            key={i}
            style={cellStyle(widths[i] + (isLast ? 0 : GAP), columnColors[i], selected)}
          >
            {cellText(value, widths[i], isLast)}
          </Span>
        );
      })}
    </Div>
  );
}

function DetailEntry({
  label,
  value,
  color,
  keyWidth,
  valueWidth,
  palette,
}: {
  label: string;
  value: string;
  color?: string | undefined;
  keyWidth: number;
  valueWidth: number;
  palette: Palette;
}) {
  const lines = wrapText(value || "—", valueWidth);
  return (
    <Div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start" }}>
      <Span style={{ width: keyWidth, flexShrink: 0, color: palette.detailKey, whiteSpace: "nowrap" }}>
        {`${label}:`}
      </Span>
      <Div style={{ display: "flex", flexDirection: "column", width: valueWidth }}>
        {lines.map((line, i) => (
          <Div key={i} style={color ? { color } : {}}>
            {line || " "}
          </Div>
        ))}
      </Div>
    </Div>
  );
}

function ModelDetails({
  model,
  onBack,
  terminalWidth,
  palette,
}: {
  model: Model;
  onBack: () => void;
  terminalWidth: number;
  palette: Palette;
}) {
  const rows = modelDetails(model, palette);
  const keyColumnWidth = rows.reduce((max, row) => Math.max(max, row.key.length), 0) + 2;
  const valueColumnWidth = Math.max(0, terminalWidth - keyColumnWidth);

  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<DivElement>(null);

  function onKeyDown(event: { key: string; preventDefault: () => void }) {
    if (event.key === "Escape") {
      event.preventDefault();
      onBack();
      return;
    }
    let delta = 0;
    if (event.key === "ArrowUp" || event.key === "k") delta = -1;
    else if (event.key === "ArrowDown" || event.key === "j") delta = 1;
    if (delta === 0) return;
    event.preventDefault();
    setScrollTop(() => {
      const el = scrollRef.current;
      if (el === null) return 0;
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      // Read the live scroll position so mouse-wheel scrolling isn't undone.
      return Math.max(0, Math.min(maxScroll, el.scrollTop + delta));
    });
  }

  return (
    <Div
      onKeyDown={onKeyDown}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: palette.bg,
        color: palette.fg,
      }}
    >
      <Div
        ref={scrollRef}
        scrollTop={scrollTop}
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          overflowY: "scroll",
          scrollbarColor: `${palette.scrollbarThumb} ${palette.scrollbarTrack}`,
        }}
      >
        <Div
          style={{
            display: "flex",
            flexDirection: "row",
            fontWeight: "bold",
            backgroundColor: palette.headerBg,
          }}
        >
          <Span style={{ padding: "0 1", fontWeight: "bold" }}>{model.name ?? model.id}</Span>
        </Div>
        {rows.map((row, i) => (
          <DetailEntry
            key={i}
            label={row.key}
            value={row.value}
            color={row.color}
            keyWidth={keyColumnWidth}
            valueWidth={valueColumnWidth}
            palette={palette}
          />
        ))}
      </Div>
      <StatusBar hints={DETAILS_HINTS} palette={palette} />
    </Div>
  );
}

export function ModelsPreview({ models }: { models: Model[] }) {
  const app = useApp();
  const terminalWidth = app.paintCannon.terminalSize.cols;

  const focused = useFocus();
  const palette = makePalette(focused);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [view, setView] = useState<"list" | "details">("list");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<DivElement>(null);

  // Filter on the displayed name-or-id column. The query matches anywhere,
  // case-insensitively.
  const anyMissingName = models.some((m) => m.name === undefined);
  const query = search.toLowerCase();
  const filtered = models.filter((m) => {
    const label = (anyMissingName ? m.id : m.name ?? m.id).toLowerCase();
    return label.includes(query);
  });

  // Keep the selection within bounds as the filter changes.
  const clampedIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));

  if (view === "details" && filtered.length > 0) {
    return (
      <ModelDetails
        model={filtered[clampedIndex]}
        onBack={() => setView("list")}
        terminalWidth={terminalWidth}
        palette={palette}
      />
    );
  }

  const nameHeader = anyMissingName ? "ID" : "Name";
  const headers = [nameHeader, HEADERS[1], HEADERS[2], HEADERS[3]];

  const columns = [
    filtered.map((m) => (anyMissingName ? m.id : m.name ?? m.id)),
    filtered.map((m) => formatContext(m.context_length)),
    filtered.map((m) => formatPrice(m.pricing?.prompt)),
    filtered.map((m) => formatPrice(m.pricing?.completion)),
  ];

  const contextWidth = columnWidth(headers[1], columns[1]);
  const promptWidth = columnWidth(headers[2], columns[2]);
  const completionWidth = columnWidth(headers[3], columns[3]);
  const fixedWidth = contextWidth + promptWidth + completionWidth;
  const gapWidth = GAP * (HEADERS.length - 1);
  const nameDesired = columnWidth(nameHeader, columns[0]);
  const nameWidth = Math.min(nameDesired, Math.max(0, terminalWidth - fixedWidth - gapWidth));
  const widths = [nameWidth, contextWidth, promptWidth, completionWidth];

  function onKeyDown(event: { key: string; preventDefault: () => void }) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (filtered.length > 0) setView("details");
      return;
    }
    let delta = 0;
    if (event.key === "ArrowUp") delta = -1;
    else if (event.key === "ArrowDown") delta = 1;
    if (delta === 0) return;
    event.preventDefault();
    const next = Math.min(filtered.length - 1, Math.max(0, clampedIndex + delta));
    setSelectedIndex(next);
    // Measure the scroll container's real height rather than guessing from the
    // terminal size, so the input's border (which adds rows) doesn't throw off
    // the scroll-into-view math. Subtract one row for the header inside it.
    setScrollTop((prev) => {
      const el = scrollRef.current;
      const visibleRows = el ? Math.max(0, el.clientHeight - 1) : 0;
      return keepVisible(next, prev, visibleRows);
    });
  }

  return (
    <Div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: palette.bg,
        color: palette.fg,
      }}
    >
      <Input
        value={search}
        placeholder="Search models..."
        autoFocus
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={onKeyDown}
        style={{
          width: "100%",
          padding: "0 1",
          color: palette.fg,
          backgroundColor: palette.headerBg,
          border: "rounded",
          borderColor: palette.detailKey,
        }}
      />
      <Div
        ref={scrollRef}
        scrollTop={scrollTop}
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          overflowY: "scroll",
          scrollbarColor: `${palette.scrollbarThumb} ${palette.scrollbarTrack}`,
        }}
      >
        <Div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            fontWeight: "bold",
            backgroundColor: palette.headerBg,
          }}
        >
          {headers.map((header, i) => {
            const isLast = i === headers.length - 1;
            const columnColors = [undefined, undefined, palette.prompt, palette.completion];
            return (
              <Span key={header} style={cellStyle(widths[i] + (isLast ? 0 : GAP), columnColors[i], true)}>
                {cellText(header, widths[i], isLast)}
              </Span>
            );
          })}
        </Div>
        {filtered.map((model, i) => (
          <ModelRow
            key={model.id}
            widths={widths}
            values={columns.map((column) => column[i])}
            even={i % 2 === 0}
            selected={i === clampedIndex}
            palette={palette}
          />
        ))}
      </Div>
      <StatusBar hints={LIST_HINTS} palette={palette} />
    </Div>
  );
}
