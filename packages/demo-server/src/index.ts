import { createServer } from "node:http";
import { ModelsResponseSpec, type ModelsResponse } from "libclank";

// Fixture models chosen to exercise the clankcall preview's rendering: a fully
// populated model, a bare-minimum one, cache/reasoning fields, a deprecated
// model, and a long description to stretch the details view's word wrapping.
const response: ModelsResponse = {
  data: [
    {
      id: "demo/omega-9000",
      name: "Omega 9000",
      created: 1735689600,
      input_modalities: ["text", "image"],
      output_modalities: ["text"],
      context_length: 256000,
      max_output_length: 8192,
      pricing: {
        prompt: "0.000003",
        completion: "0.000015",
        image: "0.005",
        request: "0.0001",
        input_cache_reads: "0.0000003",
      },
      supported_sampling_parameters: ["temperature", "top_p", "max_tokens", "seed"],
      supported_features: ["tools", "structured_outputs", "web_search"],
      hugging_face_id: "demo/omega-9000",
      quantization: "fp8",
      description:
        "Our flagship demo model. It has every field populated so you can see how the " +
        "preview renders a complete listing, including this deliberately long description " +
        "that should wrap across several lines in the details view no matter how narrow " +
        "your terminal happens to be when you run the smoke test.",
      is_ready: true,
      discount_to_user: 0.1,
      openrouter: { slug: "omega-9000" },
      datacenters: [{ country_code: "US" }, { country_code: "DE" }, { country_code: "JP" }],
      reasoning_parameters: { efforts: ["low", "medium", "high"] },
    },
    {
      id: "demo/cachehound",
      name: "CacheHound 7B",
      created: 1727740800,
      input_modalities: ["text"],
      output_modalities: ["text"],
      context_length: 128000,
      max_output_length: 4096,
      pricing: {
        prompt: "0.0000002",
        completion: "0.0000008",
        input_cache_reads: "0.00000002",
      },
      supported_sampling_parameters: ["temperature", "top_p"],
      supported_features: ["tools"],
      description: "Tiny model with aggressive prompt-caching discounts.",
      reasoning_parameters: { efforts: ["minimal", "low"] },
    },
    {
      id: "demo/oldfaithful",
      name: "Old Faithful v1",
      created: 1672531200,
      input_modalities: ["text"],
      output_modalities: ["text"],
      context_length: 8192,
      max_output_length: 2048,
      pricing: {
        prompt: "0.000001",
        completion: "0.000002",
      },
      supported_sampling_parameters: ["temperature"],
      supported_features: [],
      quantization: "int8",
      description: "Deprecated workhorse kept around for the `deprecation_date` row.",
      deprecation_date: "2025-06-01",
      is_ready: false,
    },
    {
      // Bare-minimum listing: every optional row should render as "—".
      id: "demo/mystery",
    },
  ],
};

// Fail fast at startup if the fixtures ever drift from the spec.
ModelsResponseSpec.assert(response);

const port = Number(process.env.PORT ?? 8787);

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/models") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(response));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, () => {
  console.log(`demo-server listening on http://localhost:${port}`);
  console.log(`smoke test with: clankcall preview http://localhost:${port}`);
});
