import { Div, Span } from "paintcannon-react";
import type { Palette } from "./theme.ts";

export interface Hint {
  keys: string;
  label: string;
}

export function StatusBar({ hints, palette }: { hints: Hint[]; palette: Palette }) {
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
