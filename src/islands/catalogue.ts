/**
 * The island catalogue: every component node type a host renders, each with a
 * JSON Schema (draft 2020-12) for its props. It is what an agent reads to know
 * which types it may place and what props each takes (`cms_describe` on the PHP
 * side returns the same document).
 *
 * The built-in entries — the infographic kit — live in `catalogue.json`, which
 * is byte-identical in particle-academy/fancy-cms (`resources/islands/`), so
 * the two packages describe the same types in the same words. A host adds its
 * own with `defineIsland` + `registerIslands` (`./react`), then hands the
 * serialised catalogue to its server: `islandCatalogue(islands)` here, and
 * `IslandCatalogue::builtin()->merge($json)` in PHP.
 *
 * Pure and React-free, so a server build can export the catalogue without
 * rendering anything.
 */
import builtin from "./catalogue.json";
import type { Json } from "../document/types";
import { isTextFallback, type TextFallbackStep } from "../render/text-fallback";

/** A JSON Schema object. Host schemas may `$ref` the shared `#/$defs/*` (Binding, Text, Number, Rows, format, currency, decimals, emptyText). */
export type JsonSchema = { [key: string]: Json };

/**
 * How a type reaches the browser.
 * - `none`  — static markup only; no client code (kpi, table, leaderboard).
 * - `lazy`  — server renders a fallback; the client module loads when visible (chart).
 * - `eager` — a React component rendered on the server and hydrated (most host islands).
 */
export type IslandHydration = "none" | "lazy" | "eager";

/** What the catalogue says about one type: JSON only, no code. */
export interface IslandDescriptor {
  description: string;
  hydrate: IslandHydration;
  /** JSON Schema for `node.props`; always `type: "object"`. */
  props: JsonSchema;
  /** A props object an agent can copy, bindings included. */
  example?: { [key: string]: Json };
  /** The npm package whose component renders it (kit islands). */
  package?: string;
  /** `children`: the island renders its child nodes (a Card, a Modal body); the server renders them too. */
  slot?: "children";
  /** Which props are its text, for the server render (render/text-fallback.ts). */
  textFallback?: TextFallbackStep[];
}

export interface IslandCatalogueJson {
  $schema: string;
  $defs: { [key: string]: Json };
  types: { [type: string]: IslandDescriptor };
}

/** The shipped catalogue: the four infographic node types. */
export const BUILTIN_ISLAND_CATALOGUE = builtin as unknown as IslandCatalogueJson;

/**
 * What a host island may be called: a lowercase namespace and a name
 * (`kit:Chart`), or a single lowercase word. One colon at most, no spaces, and
 * nothing that could address an object prototype.
 */
export const ISLAND_TYPE_PATTERN = /^[a-z][a-z0-9-]*(:[A-Za-z][A-Za-z0-9-]*)?$/;

const HYDRATIONS = new Set<string>(["none", "lazy", "eager"]);

/** The JSON a descriptor serialises to, in a fixed key order. */
export function descriptorJson(type: string, d: IslandDescriptor): IslandDescriptor {
  if (typeof d.description !== "string" || d.description.trim() === "") throw new Error(`[fancy-cms] island "${type}" needs a description.`);
  if (!HYDRATIONS.has(d.hydrate)) throw new Error(`[fancy-cms] island "${type}" hydrate must be none, lazy or eager.`);
  if (typeof d.props !== "object" || d.props === null || Array.isArray(d.props) || d.props.type !== "object") {
    throw new Error(`[fancy-cms] island "${type}" props must be a JSON object schema ({ "type": "object", ... }).`);
  }
  if (d.example !== undefined && (typeof d.example !== "object" || d.example === null || Array.isArray(d.example))) {
    throw new Error(`[fancy-cms] island "${type}" example must be a props object.`);
  }
  if (d.package !== undefined && (typeof d.package !== "string" || d.package === "")) throw new Error(`[fancy-cms] island "${type}" package must be a package name.`);
  if (d.slot !== undefined && d.slot !== "children") throw new Error(`[fancy-cms] island "${type}" slot must be "children".`);
  if (d.textFallback !== undefined && !isTextFallback(d.textFallback as unknown as Json)) throw new Error(`[fancy-cms] island "${type}" textFallback must be a list of {text}, {code} or {list, fields?} steps.`);
  const out: IslandDescriptor = { description: d.description, hydrate: d.hydrate, props: d.props };
  if (d.example !== undefined) out.example = d.example;
  if (d.package !== undefined) out.package = d.package;
  if (d.slot !== undefined) out.slot = d.slot;
  if (d.textFallback !== undefined) out.textFallback = d.textFallback;
  return out;
}

/**
 * The catalogue for a set of islands, as JSON. Pass the registry a page renders
 * with; what comes back is safe to `JSON.stringify` and hand to the server.
 */
export function islandCatalogue(islands: { [type: string]: IslandDescriptor }): IslandCatalogueJson {
  const types: { [type: string]: IslandDescriptor } = {};
  for (const [type, d] of Object.entries(islands)) types[type] = descriptorJson(type, d);
  return { $schema: BUILTIN_ISLAND_CATALOGUE.$schema, $defs: BUILTIN_ISLAND_CATALOGUE.$defs, types };
}
