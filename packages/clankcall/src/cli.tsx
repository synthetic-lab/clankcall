import { Command } from "commander";
import { render } from "paintcannon-react";
import { ModelsResponseSpec, type Model } from "./models.js";
import { ModelsTable } from "./show.js";

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

async function show(baseUrl: string, apiKey?: string): Promise<void> {
  const models = await fetchModels(baseUrl, apiKey);
  const app = render(<ModelsTable models={models} />, { alternateScreen: true, captureMouse: true });
  await app.waitUntilExit();
}

const program = new Command();

program
  .name("clankcall")
  .description("Render OpenRouter-compatible model listings in your terminal")
  .version("0.0.0");

program
  .command("show <base-url>")
  .description("Fetch <base-url>/models, validate it, and render a table")
  .option("-k, --api-key <key>", "API key sent as a Bearer token")
  .action((baseUrl: string, options: { apiKey?: string }) => show(baseUrl, options.apiKey));

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
