import { Command } from "commander";
import { render } from "paintcannon-react";
import { ModelsResponseSpec, type Model } from "./models.ts";
import { ModelsPreview } from "./preview.tsx";
import { AddProvider, saveProvider } from "./add.tsx";
import { ClankfileTypeSpec } from "./clankfile.ts";

async function fetchModels(baseUrl: string, apiKey?: string): Promise<Model[]> {
  const url = baseUrl.replace(/\/$/, "") + "/models";
  const headers: Record<string, string> = {};
  if (apiKey !== undefined) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const validated = ModelsResponseSpec.assert(data);
  return validated.data;
}

async function preview(baseUrl: string, apiKey?: string): Promise<void> {
  const models = await fetchModels(baseUrl, apiKey);
  const app = render(<ModelsPreview models={models} />, { alternateScreen: true, captureMouse: true });
  await app.waitUntilExit();
}

interface AddOptions {
  baseUrl?: string;
  type?: string;
  envVar?: string;
}

async function addProvider(provider: string, options: AddOptions): Promise<void> {
  const provided = [options.baseUrl, options.type, options.envVar].filter(
    (v) => v !== undefined,
  ).length;

  // Headless mode requires all three flags together; a partial set is a
  // mistake, so report exactly which ones are missing rather than guessing.
  if (provided > 0 && provided < 3) {
    const missing: string[] = [];
    if (options.baseUrl === undefined) missing.push("--base-url");
    if (options.type === undefined) missing.push("--type");
    if (options.envVar === undefined) missing.push("--env-var");
    throw new Error(
      `--base-url, --type, and --env-var must be passed together; missing ${missing.join(", ")}`,
    );
  }

  if (provided === 3) {
    const { baseUrl, type: rawType, envVar } = options;
    if (baseUrl === undefined || rawType === undefined || envVar === undefined) {
      throw new Error("internal error: expected all three flags to be set");
    }
    const type = ClankfileTypeSpec.assert(rawType);
    await saveProvider(provider, { baseUrl, type, envVar });
    return;
  }

  const app = render(<AddProvider provider={provider} />, { alternateScreen: true });
  await app.waitUntilExit();
}

const program = new Command();

program
  .name("clankcall")
  .description("Render OpenRouter-compatible model listings in your terminal")
  .version("0.0.0");

program
  .command("preview <base-url>")
  .description("Fetch <base-url>/models, validate it, and render a table")
  .option("-k, --api-key <key>", "API key sent as a Bearer token")
  .action((baseUrl: string, options: { apiKey?: string }) => preview(baseUrl, options.apiKey));

program
  .command("add <provider>")
  .description("Add a provider: prompt for a base URL and an auth env var, then save to ~/.config/clankcall")
  .option("--base-url <url>", "Provider base URL (skips the prompt when passed with --type and --env-var)")
  .option("--type <type>", "Provider type, e.g. chat-completions (skips the prompt when passed with --base-url and --env-var)")
  .option("--env-var <name>", "Auth env var name (skips the prompt when passed with --base-url and --type)")
  .action((provider: string, options: AddOptions) => addProvider(provider, options));

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
