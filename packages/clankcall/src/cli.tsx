import { Command } from "commander";
import { render } from "paintcannon-react";
import {
  ModelCategoryResponseSpec,
  ModelsResponseSpec,
  ClankfileTypeSpec,
  type ModelCategory,
} from "libclank";
import { ModelsPreview } from "./preview.tsx";
import { AddProvider, saveProvider } from "./add.tsx";

// Pull a human-readable reason out of a fetch failure. Network errors surface
// as `TypeError: fetch failed` with the real reason (e.g. ECONNREFUSED, one
// entry per resolved address) nested in `cause`.
function describeFetchFailure(err: unknown): string {
  const cause = err instanceof Error ? err.cause : undefined;
  if (cause instanceof AggregateError) {
    const reasons = cause.errors.map((e) => (e instanceof Error ? e.message : String(e)));
    return [...new Set(reasons)].join("; ") || cause.message;
  }
  if (cause instanceof Error) return cause.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

// Fetch the given models URL and normalize to categories: prefer the
// categorized response shape, falling back to a raw model list wrapped in a
// single catch-all category.
async function fetchModels(url: string, apiKey?: string): Promise<ModelCategory[]> {
  const headers: Record<string, string> = {};
  if (apiKey !== undefined) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    throw new Error(`Failed to fetch ${url}: ${describeFetchFailure(err)}`);
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const data: unknown = await res.json();
  if (ModelCategoryResponseSpec.guard(data)) {
    return data.categories;
  }
  const validated = ModelsResponseSpec.assert(data);
  return [{ name: "Models", models: validated.data }];
}

async function preview(url: string, apiKey?: string): Promise<void> {
  const categories = await fetchModels(url, apiKey);
  const app = render(<ModelsPreview categories={categories} />, { alternateScreen: true, captureMouse: true });
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
  .command("preview <url>")
  .description("Fetch a model listing URL (e.g. https://provider.example/v1/models), validate it, and render a table")
  .option("-k, --api-key <key>", "API key sent as a Bearer token")
  .action((url: string, options: { apiKey?: string }) => preview(url, options.apiKey));

program
  .command("add <provider>")
  .description("Add a provider: prompt for a base URL and an auth env var, then save to ~/.config/clankcall")
  .option("--base-url <url>", "Provider base URL (skips the prompt when passed with --type and --env-var)")
  .option("--type <type>", "Provider type, e.g. chat-completions (skips the prompt when passed with --base-url and --env-var)")
  .option("--env-var <name>", "Auth env var name (skips the prompt when passed with --base-url and --type)")
  .action((provider: string, options: AddOptions) => addProvider(provider, options));

program.parseAsync(process.argv).catch((err: unknown) => {
  // Print just the message: stack traces of expected failures (connection
  // refused, validation errors) are noise for CLI users.
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
