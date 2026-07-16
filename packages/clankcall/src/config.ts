import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import JSON5 from "json5";
import { t } from "structural";
import { ClankfileSpec, ClankauthSpec } from "./clankfile.ts";

export type Clankfile = t.GetType<typeof ClankfileSpec>;
export type Clankauth = t.GetType<typeof ClankauthSpec>;

// ~/.config/clankcall, respecting XDG_CONFIG_HOME when set.
export function configDir(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "clankcall");
}

export function clankfilePath(): string {
  return path.join(configDir(), "Clankfile.json5");
}

export function clankauthPath(): string {
  return path.join(configDir(), "Clankauth.json5");
}

function isENOENT(err: unknown): boolean {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT";
}

// Reads and validates a JSON5 config file. A missing file is treated as an
// empty mapping rather than an error, so a fresh install just starts blank.
async function readJson5<T>(filePath: string, spec: { assert(val: unknown): T }): Promise<T> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return spec.assert(JSON5.parse(text));
  } catch (err) {
    if (isENOENT(err)) return {} as T;
    throw err;
  }
}

export function readClankfile(): Promise<Clankfile> {
  return readJson5(clankfilePath(), ClankfileSpec);
}

export function readClankauth(): Promise<Clankauth> {
  return readJson5(clankauthPath(), ClankauthSpec);
}

async function writeJson5(filePath: string, data: unknown, header: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${header}\n${JSON5.stringify(data, null, 2)}\n`, "utf8");
}

export function writeClankfile(data: Clankfile): Promise<void> {
  return writeJson5(
    clankfilePath(),
    data,
    "// Clankfile.json5: provider name -> { type, baseUrl }",
  );
}

export function writeClankauth(data: Clankauth): Promise<void> {
  return writeJson5(
    clankauthPath(),
    data,
    "// Clankauth.json5: provider name -> auth mechanism (env var)",
  );
}
