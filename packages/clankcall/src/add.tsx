import { useState } from "react";
import { Div, Form, Input, Span, useApp } from "paintcannon-react";
import { makePalette, useFocus } from "./theme.ts";
import { StatusBar, type Hint } from "./status-bar.tsx";
import {
  readClankauth,
  readClankfile,
  writeClankauth,
  writeClankfile,
} from "./config.ts";
import type { ClankfileType } from "libclank";

type Step = "baseUrl" | "envVar" | "confirm";

const HINTS: Hint[] = [
  { keys: "enter", label: "submit" },
  { keys: "ctrl-c", label: "quit" },
];

const DEFAULT_BASE_URL = "https://api.synthetic.new/openai/v1";
const DEFAULT_ENV_VAR = "SYNTHETIC_API_KEY";

const STEP_TITLES: Record<Step, string> = {
  baseUrl: "Base URL",
  envVar: "Auth — env var",
  confirm: "Confirm",
};

export interface ProviderInput {
  baseUrl: string;
  type: ClankfileType;
  envVar: string;
}

// Reads the existing config files, upserts the provider into both, and writes
// them back. Shared by the interactive TUI and the headless CLI path so they
// can never drift in how they persist.
export async function saveProvider(provider: string, input: ProviderInput): Promise<void> {
  const [clankfile, clankauth] = await Promise.all([readClankfile(), readClankauth()]);
  clankfile[provider] = { type: input.type, baseUrl: input.baseUrl };
  clankauth[provider] = { type: "env-var", name: input.envVar };
  await Promise.all([writeClankfile(clankfile), writeClankauth(clankauth)]);
}

function inputStyle(palette: ReturnType<typeof makePalette>) {
  return {
    width: "100%",
    padding: "0 1",
    color: palette.fg,
    backgroundColor: palette.headerBg,
    border: "rounded",
    borderColor: palette.detailKey,
    placeholderColor: palette.barLabel,
  } as const;
}

export function AddProvider({ provider }: { provider: string }) {
  const app = useApp();
  const focused = useFocus();
  const palette = makePalette(focused);

  const [step, setStep] = useState<Step>("baseUrl");
  const [baseUrl, setBaseUrl] = useState("");
  const [envVar, setEnvVar] = useState("");

  async function handleSubmit(event: { preventDefault(): void; stopPropagation(): void }) {
    const baseUrlValue = baseUrl.trim();
    const envVarValue = envVar.trim();

    const hasData =
      step === "baseUrl" ? baseUrlValue !== "" :
      step === "envVar" ? envVarValue !== "" :
      baseUrlValue !== "" && envVarValue !== "";

    if (!hasData) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (step === "baseUrl") {
      setStep("envVar");
      return;
    }
    if (step === "envVar") {
      setStep("confirm");
      return;
    }
    await saveProvider(provider, {
      baseUrl: baseUrlValue,
      type: "chat-completions",
      envVar: envVarValue,
    });
    app.exit();
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
      <Div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "0 1",
          backgroundColor: palette.headerBg,
        }}
      >
        <Span style={{ fontWeight: "bold" }}>{`Add provider · ${provider}`}</Span>
        <Span style={{ color: palette.detailKey }}>{STEP_TITLES[step]}</Span>
      </Div>

      <Div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          padding: "1",
        }}
      >
        {step === "baseUrl" && (
          <Form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
            <Span style={{ color: palette.detailKey, padding: "0 0 0 0" }}>Base URL</Span>
            <Input
              key="baseUrl"
              autoFocus
              value={baseUrl}
              placeholder={DEFAULT_BASE_URL}
              onChange={(e) => setBaseUrl(e.target.value)}
              style={inputStyle(palette)}
            />
          </Form>
        )}

        {step === "envVar" && (
          <Form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
            <Span style={{ color: palette.detailKey }}>Environment variable name</Span>
            <Input
              key="envVar"
              autoFocus
              value={envVar}
              placeholder={DEFAULT_ENV_VAR}
              onChange={(e) => setEnvVar(e.target.value)}
              style={inputStyle(palette)}
            />
          </Form>
        )}

        {step === "confirm" && (
          <Form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
            <Div style={{ display: "flex", flexDirection: "column", padding: "0 0 1 0" }}>
              <Div style={{ display: "flex", flexDirection: "row" }}>
                <Span style={{ width: 12, flexShrink: 0, color: palette.detailKey }}>provider:</Span>
                <Span>{provider}</Span>
              </Div>
              <Div style={{ display: "flex", flexDirection: "row" }}>
                <Span style={{ width: 12, flexShrink: 0, color: palette.detailKey }}>baseUrl:</Span>
                <Span>{baseUrl}</Span>
              </Div>
              <Div style={{ display: "flex", flexDirection: "row" }}>
                <Span style={{ width: 12, flexShrink: 0, color: palette.detailKey }}>auth:</Span>
                <Span>{`env-var ${envVar}`}</Span>
              </Div>
            </Div>
            <Input
              key="confirm"
              autoFocus
              value=""
              placeholder="Press Enter to save"
              onChange={() => {}}
              style={inputStyle(palette)}
            />
          </Form>
        )}
      </Div>

      <StatusBar hints={HINTS} palette={palette} />
    </Div>
  );
}
