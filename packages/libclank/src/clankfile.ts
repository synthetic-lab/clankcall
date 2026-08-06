import { t } from "structural";
import { ModelCategorySpec, ModelSpec } from "./models.ts";

/*
 * The supported provider types in Clankfile.json5.
 */
export const ClankfileTypeSpec = t.value("chat-completions");
export type ClankfileType = t.GetType<typeof ClankfileTypeSpec>;

/*
 * A single entry in Clankfile.json5: a provider's base URL.
 */
export const ClankfileEntrySpec = t.subtype({
  type: ClankfileTypeSpec,
  baseUrl: t.str,
});
export type ClankfileEntry = t.GetType<typeof ClankfileEntrySpec>;

/*
 * The Clankfile.json5 encodes a mapping of provider names to base URLs
 */
export const ClankfileSpec = t.dict(ClankfileEntrySpec);

/*
 * A single entry in Clankauth.json5: a provider's auth mechanism.
 */
export const ClankauthEntrySpec = t.subtype({
  type: t.value("env-var"),
  name: t.str,
});
export type ClankauthEntry = t.GetType<typeof ClankauthEntrySpec>;

/*
 * The Clankauth.json5 encodes a mapping of provider names to auth mechanisms (currently, env vars)
 */
export const ClankauthSpec = t.dict(ClankauthEntrySpec);

/*
 * Cached /models payload. Endpoints return either categorized or raw model
 * responses, so the cache stores a discriminated union of the two.
 */
export const CachedDataSpec = t.subtype({
  type: t.value("category"),
  category: ModelCategorySpec,
}).or(t.subtype({
  type: t.value("model"),
  model: ModelSpec,
}));
export type CachedData = t.GetType<typeof CachedDataSpec>;

/*
 * A single entry in Clankcache.json5: a cached /models response.
 */
export const ClankcacheEntrySpec = t.subtype({
  cached: CachedDataSpec,
  lastFetched: t.str,
});
export type ClankcacheEntry = t.GetType<typeof ClankcacheEntrySpec>;

/*
 * The Clankcache.json5 is a cache of data returned from /models endpoints
 */
export const ClankcacheSpec = t.dict(ClankcacheEntrySpec);
