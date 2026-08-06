import { t } from "structural";

// Pricing for a model. Values are decimal strings, since OpenRouter reports
// pricing as string-valued per-unit amounts.
export const PricingSpec = t.subtype({
  prompt: t.str.comment("Pricing per 1 token"),
  completion: t.str.comment("Pricing per 1 token"),
  image: t.optional(t.str.comment("Pricing per 1 image")),
  request: t.optional(t.str.comment("Pricing per 1 request")),
  input_cache_reads: t.optional(t.str.comment("Pricing per 1 token")),
});
export type Pricing = t.GetType<typeof PricingSpec>;

// OpenRouter-specific metadata for a model.
export const OpenrouterMetaSpec = t.subtype({
  slug: t.str,
});
export type OpenrouterMeta = t.GetType<typeof OpenrouterMetaSpec>;

// A datacenter hosting a model.
export const DatacenterSpec = t.subtype({
  country_code: t.str.comment("Iso3166Alpha2Code"),
});
export type Datacenter = t.GetType<typeof DatacenterSpec>;

// The OpenRouter model-provider spec, minus the model id. Each field keeps the
// required/optional status from the spec. Real-world providers rarely follow
// the full spec, so `ModelSpec` below loosens every field except `id`.
export const OpenRouterSpec = t.subtype({
  // Required by the spec
  name: t.str,
  created: t.num,
  input_modalities: t.array(t.str),
  output_modalities: t.array(t.str),
  context_length: t.num,
  max_output_length: t.num,
  pricing: PricingSpec,
  supported_sampling_parameters: t.array(t.str),
  supported_features: t.array(t.str),
  // Optional per the spec
  hugging_face_id: t.optional(
    t.str.comment("Required if the model is on Hugging Face"),
  ),
  quantization: t.optional(t.str),
  description: t.optional(t.str),
  deprecation_date: t.optional(t.str.comment("ISO 8601 date or UTC hour")),
  is_ready: t.optional(
    t.bool.comment("false keeps the model staged-but-hidden on OpenRouter"),
  ),
  discount_to_user: t.optional(
    t.num.comment("Fractional discount on user-facing pricing (0 = none)"),
  ),
  openrouter: t.optional(OpenrouterMetaSpec),
  datacenters: t.optional(t.array(DatacenterSpec)),
});

// Extensions to OR spec for useful fields for agent harnesses
export const ClankExtSpec = t.subtype({
  reasoning_parameters: t.subtype({
    efforts: t.array(t.str),
  }),
});

// A single model entry. Only `id` is required; every other spec field is
// optional, since real providers commonly publish little beyond the id.
export const ModelSpec = t.partial(OpenRouterSpec)
  .and(t.partial(ClankExtSpec))
  .and(t.subtype({ id: t.str }));
export type Model = t.GetType<typeof ModelSpec>;

// Top-level response shape of the OpenRouter models endpoint.
export const ModelsResponseSpec = t.subtype({
  data: t.array(ModelSpec),
});
export type ModelsResponse = t.GetType<typeof ModelsResponseSpec>;
