/**
 * What data a page asks its host for — the seam between a document and the data
 * context it renders against.
 *
 * A page carries the shape and the host supplies the numbers: every `{ $bind }`
 * is a request for a value at a path. `dataRequests(doc)` lists them, with the
 * literal JSON Schema the node expects at that prop when the island catalogue
 * knows the type (a chart's `series` expects an array of series, a tile's
 * `value` a number). A host reads the list, fetches, and re-supplies the result
 * as `data` to `CmsPage` / `PageRenderer::render` — the same `data` argument
 * that exists today, so nothing about rendering changes.
 *
 * Phase 2 (page inputs) and phase 3 (a host data catalogue) build on this list
 * rather than on a second walk of the document. The PHP twin is
 * `FancyCms\Data\DataRequests::of()`, with identical output.
 */
import { isLiveBinding, type BindingSource } from "./bindings";
import { hasNodeMap, isBinding, type Json, type Node, type PageDoc } from "./types";
import { BUILTIN_ISLAND_CATALOGUE, type IslandCatalogueJson, type JsonSchema } from "../islands/catalogue";

export interface DataRequest {
  node: string;
  /** The prop holding the binding, or `repeat.each` for a repeater's list. */
  prop: string;
  /** The dot path into the data context. */
  path: string;
  /** The live query key, when the binding names one. */
  source?: BindingSource;
  /** The literal shape the catalogue declares for this prop, or null when none is declared. */
  expects: JsonSchema | null;
}

const has = Object.prototype.hasOwnProperty;
const BINDING_REF = "#/$defs/Binding";

function deref(schema: unknown, defs: { [key: string]: Json }, depth = 0): JsonSchema | null {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema) || depth > 8) return null;
  const s = schema as JsonSchema;
  const ref = s.$ref;
  if (typeof ref === "string" && ref.startsWith("#/$defs/")) {
    const name = ref.slice("#/$defs/".length);
    return has.call(defs, name) ? deref(defs[name], defs, depth + 1) : null;
  }
  if (Array.isArray(s.anyOf)) {
    for (const branch of s.anyOf) {
      if (typeof branch === "object" && branch !== null && !Array.isArray(branch) && (branch as JsonSchema).$ref === BINDING_REF) continue;
      return deref(branch, defs, depth + 1);
    }
    return null;
  }
  return s;
}

/** The literal (non-binding) schema a catalogue declares for `type.props[prop]`. */
export function expectedShape(catalogue: IslandCatalogueJson, type: string, prop: string): JsonSchema | null {
  if (!has.call(catalogue.types, type)) return null;
  const properties = (catalogue.types[type]!.props as { properties?: unknown }).properties;
  if (typeof properties !== "object" || properties === null || !has.call(properties, prop)) return null;
  return deref((properties as JsonSchema)[prop], catalogue.$defs);
}

function request(id: string, type: unknown, prop: string, binding: unknown, catalogue: IslandCatalogueJson): DataRequest | null {
  if (!isBinding(binding)) return null;
  const expects = typeof type === "string" ? expectedShape(catalogue, type, prop) : null;
  return isLiveBinding(binding)
    ? { node: id, prop, path: binding.$bind, source: binding.$source, expects }
    : { node: id, prop, path: binding.$bind, expects };
}

/** Every bound value a document reads, ordered by node id then prop. */
export function dataRequests(doc: PageDoc, catalogue: IslandCatalogueJson = BUILTIN_ISLAND_CATALOGUE): DataRequest[] {
  if (!hasNodeMap(doc)) return [];
  const out: DataRequest[] = [];
  for (const id of Object.keys(doc.nodes).sort()) {
    const node = doc.nodes[id] as Node | null;
    if (typeof node !== "object" || node === null) continue;
    const props = typeof node.props === "object" && node.props !== null && !Array.isArray(node.props) ? node.props : {};
    for (const key of Object.keys(props)) {
      const r = request(id, node.type, key, props[key], catalogue);
      if (r) out.push(r);
    }
    const repeat = node.repeat as { each?: unknown } | undefined;
    const r = request(id, node.type, "repeat.each", typeof repeat === "object" && repeat !== null ? repeat.each : undefined, catalogue);
    if (r) out.push(r);
  }
  return out;
}
