import { useRef, useState } from "react";
import { Div, Input, Span, useApp } from "paintcannon-react";
import type { DivElement } from "paintcannon";
import type { Model, ModelCategory } from "libclank";
import { makePalette, useFocus, type Palette } from "./theme.ts";
import { StatusBar, type Hint } from "./status-bar.tsx";

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

interface DetailRow {
  key: string;
  value: string;
  color?: string;
}

// Flatten a model into ordered key/value pairs, following the field order
// declared in libclank's models.ts. Nested objects use dotted keys; arrays of objects
// are joined. Every field renders even when absent (as "—"), so it's visible
// at a glance which fields a provider isn't publishing. Accent colors are
// resolved from the palette so they dim together with the rest of the UI.
function modelDetails(model: Model, palette: Palette): DetailRow[] {
  return [
    { key: "id", value: model.id },
    { key: "name", value: model.name ?? "—" },
    { key: "created", value: model.created !== undefined ? String(model.created) : "—" },
    { key: "input_modalities", value: model.input_modalities?.join(", ") ?? "—" },
    { key: "output_modalities", value: model.output_modalities?.join(", ") ?? "—" },
    { key: "context_length", value: formatContext(model.context_length) },
    { key: "max_output_length", value: formatContext(model.max_output_length) },
    { key: "pricing.prompt", value: formatPrice(model.pricing?.prompt), color: palette.prompt },
    { key: "pricing.completion", value: formatPrice(model.pricing?.completion), color: palette.completion },
    { key: "pricing.image", value: formatPrice(model.pricing?.image) },
    { key: "pricing.request", value: formatPrice(model.pricing?.request) },
    { key: "pricing.input_cache_reads", value: formatPrice(model.pricing?.input_cache_reads), color: palette.cacheRead },
    { key: "supported_sampling_parameters", value: model.supported_sampling_parameters?.join(", ") ?? "—" },
    { key: "supported_features", value: model.supported_features?.join(", ") ?? "—" },
    { key: "hugging_face_id", value: model.hugging_face_id ?? "—" },
    { key: "quantization", value: model.quantization ?? "—" },
    { key: "description", value: model.description ?? "—" },
    { key: "deprecation_date", value: model.deprecation_date ?? "—" },
    { key: "is_ready", value: model.is_ready !== undefined ? String(model.is_ready) : "—" },
    { key: "discount_to_user", value: model.discount_to_user !== undefined ? String(model.discount_to_user) : "—" },
    { key: "openrouter.slug", value: model.openrouter?.slug ?? "—" },
    { key: "datacenters", value: model.datacenters?.map((dc) => dc.country_code).join(", ") ?? "—" },
    { key: "reasoning_parameters.efforts", value: model.reasoning_parameters?.efforts.join(", ") ?? "—" },
    { key: "rollingRelease.alias", value: model.rollingRelease?.alias ?? "—" },
  ];
}

const HEADERS = ["Name", "Context", "Cache Reads", "Prompt", "Completion"];
const GAP = 2;
// Badge prepended to the name cell of rolling-release rows. Its length eats
// into the name column's width so the other columns stay aligned.
const ALIAS_BADGE = "(alias) ";

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

function ModelRow({
  widths,
  values,
  even,
  selected,
  palette,
  badge,
}: {
  widths: number[];
  values: string[];
  even: boolean;
  selected: boolean;
  palette: Palette;
  // Colored badge rendered at the start of the name cell; its length is
  // subtracted from the name column's width so the other columns align.
  badge?: { text: string; color: string } | undefined;
}) {
  // Per-column text color; indexed to match the column order in HEADERS. The
  // pricing accents come from the palette so they dim when unfocused.
  const columnColors = [undefined, undefined, palette.cacheRead, palette.prompt, palette.completion];
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
        if (i === 0 && badge !== undefined) {
          const textWidth = Math.max(0, widths[0] - badge.text.length);
          return (
            <Div
              key={i}
              style={{
                ...cellStyle(widths[0] + GAP, columnColors[0], selected),
                display: "flex",
                flexDirection: "row",
              }}
            >
              <Span style={{ color: badge.color }}>{badge.text}</Span>
              <Span>{cellText(value, textWidth, false)}</Span>
            </Div>
          );
        }
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

function TableHeader({
  headers,
  widths,
  palette,
}: {
  headers: string[];
  widths: number[];
  palette: Palette;
}) {
  // Per-column text color; indexed to match the column order in HEADERS.
  const columnColors = [undefined, undefined, palette.cacheRead, palette.prompt, palette.completion];
  return (
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
        return (
          <Span key={header} style={cellStyle(widths[i] + (isLast ? 0 : GAP), columnColors[i], true)}>
            {cellText(header, widths[i], isLast)}
          </Span>
        );
      })}
    </Div>
  );
}

// A table of models within a category section. `start` is the table's offset
// into the flattened selection list.
interface SectionTable {
  start: number;
  models: Model[];
}

interface Section {
  name: string;
  recommended: boolean;
  tables: SectionTable[];
}

// One selectable row in the flattened list. `line` is the row's absolute
// position in the scroll container (counting section titles and table
// headers), used for scroll-into-view math.
interface FlatRow {
  model: Model;
  line: number;
}

export function ModelsPreview({ categories }: { categories: ModelCategory[] }) {
  const app = useApp();
  const terminalWidth = app.paintCannon.terminalSize.cols;

  const focused = useFocus();
  const palette = makePalette(focused);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [view, setView] = useState<"list" | "details">("list");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<DivElement>(null);

  const anyMissingName = categories.some((c) => c.models.some((m) => m.name === undefined));

  // Rolling-release rows show what the alias tracks, e.g. "Fast → omega-9000".
  function displayName(m: Model): string {
    const base = anyMissingName ? m.id : m.name ?? m.id;
    return m.rollingRelease !== undefined ? `${base} → ${m.rollingRelease.alias}` : base;
  }

  function rowValues(m: Model): string[] {
    return [
      displayName(m),
      formatContext(m.context_length),
      formatPrice(m.pricing?.input_cache_reads),
      formatPrice(m.pricing?.prompt),
      formatPrice(m.pricing?.completion),
    ];
  }

  // Filter on the displayed name column (query matches anywhere,
  // case-insensitively), split each category into rolling-release and
  // permanent tables, and flatten all rows for keyboard selection.
  const query = search.toLowerCase();
  const flatRows: FlatRow[] = [];
  const sections: Section[] = [];
  let line = 0;
  for (const category of categories) {
    const matches = category.models.filter((m) => displayName(m).toLowerCase().includes(query));
    if (matches.length === 0) continue;
    if (sections.length > 0) line++; // spacer between sections
    const section: Section = {
      name: category.name,
      recommended: category.recommended === true,
      tables: [],
    };
    line++; // category title
    line++; // column header (shared by both tables in the section)
    // Rolling releases come first, then permanent models; the "→ alias" in
    // the name column is what distinguishes them visually.
    const rolling = matches.filter((m) => m.rollingRelease !== undefined);
    const permanent = matches.filter((m) => m.rollingRelease === undefined);
    for (const models of [rolling, permanent]) {
      if (models.length === 0) continue;
      const table: SectionTable = {
        start: flatRows.length,
        models,
      };
      for (const model of models) flatRows.push({ model, line: line++ });
      section.tables.push(table);
    }
    sections.push(section);
  }

  // Keep the selection within bounds as the filter changes.
  const clampedIndex = Math.min(selectedIndex, Math.max(0, flatRows.length - 1));

  if (view === "details" && flatRows.length > 0) {
    return (
      <ModelDetails
        model={flatRows[clampedIndex].model}
        onBack={() => setView("list")}
        terminalWidth={terminalWidth}
        palette={palette}
      />
    );
  }

  const nameHeader = anyMissingName ? "ID" : "Name";
  const headers = [nameHeader, HEADERS[1], HEADERS[2], HEADERS[3], HEADERS[4]];

  // Column widths are computed across every visible model so all tables align,
  // regardless of which category or split they belong to.
  const allModels = flatRows.map((row) => row.model);
  const contextWidth = columnWidth(headers[1], allModels.map((m) => formatContext(m.context_length)));
  const cacheReadWidth = columnWidth(headers[2], allModels.map((m) => formatPrice(m.pricing?.input_cache_reads)));
  const promptWidth = columnWidth(headers[3], allModels.map((m) => formatPrice(m.pricing?.prompt)));
  const completionWidth = columnWidth(headers[4], allModels.map((m) => formatPrice(m.pricing?.completion)));
  const fixedWidth = contextWidth + cacheReadWidth + promptWidth + completionWidth;
  const gapWidth = GAP * (HEADERS.length - 1);
  const nameDesired = columnWidth(
    nameHeader,
    // Rolling-release rows also carry the alias badge inside the name cell.
    allModels.map((m) => (m.rollingRelease !== undefined ? ALIAS_BADGE : "") + displayName(m)),
  );
  const nameWidth = Math.min(nameDesired, Math.max(0, terminalWidth - fixedWidth - gapWidth));
  const widths = [nameWidth, contextWidth, cacheReadWidth, promptWidth, completionWidth];

  function onKeyDown(event: { key: string; preventDefault: () => void }) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (flatRows.length > 0) setView("details");
      return;
    }
    let delta = 0;
    if (event.key === "ArrowUp") delta = -1;
    else if (event.key === "ArrowDown") delta = 1;
    if (delta === 0) return;
    event.preventDefault();
    const next = Math.min(flatRows.length - 1, Math.max(0, clampedIndex + delta));
    setSelectedIndex(next);
    // Measure the scroll container's real height rather than guessing from the
    // terminal size, so the input's border (which adds rows) doesn't throw off
    // the scroll-into-view math. Row lines are absolute positions within the
    // scroll container, so headers are already accounted for.
    setScrollTop((prev) => {
      const el = scrollRef.current;
      const visibleRows = el ? el.clientHeight : 0;
      return keepVisible(flatRows[next]?.line ?? 0, prev, visibleRows);
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
        {sections.map((section, sectionIndex) => (
          <Div key={section.name} style={{ display: "flex", flexDirection: "column" }}>
            {sectionIndex > 0 && <Div>{" "}</Div>}
            <Div style={{ padding: "0 1", fontWeight: "bold", color: palette.detailKey }}>
              {section.recommended ? `${section.name} (recommended)` : section.name}
            </Div>
            <TableHeader headers={headers} widths={widths} palette={palette} />
            {section.tables.map((table, tableIndex) => (
              <Div key={tableIndex} style={{ display: "flex", flexDirection: "column" }}>
                {table.models.map((model, i) => (
                  <ModelRow
                    key={model.id}
                    widths={widths}
                    values={rowValues(model)}
                    even={i % 2 === 0}
                    selected={table.start + i === clampedIndex}
                    palette={palette}
                    badge={
                      model.rollingRelease !== undefined
                        ? { text: ALIAS_BADGE, color: palette.alias }
                        : undefined
                    }
                  />
                ))}
              </Div>
            ))}
          </Div>
        ))}
        {flatRows.length === 0 && (
          <Div style={{ padding: "0 1", color: palette.detailKey }}>No matching models.</Div>
        )}
      </Div>
      <StatusBar hints={LIST_HINTS} palette={palette} />
    </Div>
  );
}
