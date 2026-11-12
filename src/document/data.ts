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
import { inputValues, type InputValues } from "../render/inputs";

export interface DataRequest {
  node: string;
  /** The prop holding the binding, or `repeat.each` for a repeater's list. */
  prop: string;
  /** The dot path into the data context. */
  path: string;
  /** The live query key, when the binding names one. */
  source?: BindingSource;
  /** The binding's `$params` (stream parameters), as written, when it is an object. */
  params?: { [key: string]: Json };
  /** The binding's `$scope` (scope parameters), as written, when it is an object. */
  scope?: { [key: string]: Json };
  /** The literal shape the catalogue declares for this prop, or null when none is declared. */
  expects: JsonSchema | null;
}

/**
 * One request the host answers: a stream, under an optional alias, with its
 * params and scope, and every binding that reads its result. The host puts the
 * result in the data context under `key` (`metrics` or `metrics#byStage`), so
 * the bindings resolve unchanged.
 */
export interface DataQuery {
  /** The bindings' first path segment: `<stream>` or `<stream>#<alias>`. */
  key: string;
  stream: string;
  alias: string | null;
  /** `$params` with every `{ "$input": name }` replaced by that page input's current value. */
  params: { [key: string]: unknown };
  /** `$scope`, resolved the same way. Passed through as written: the host applies it against the viewer. */
  scope: { [key: string]: unknown };
  /** The page inputs this query reads, sorted: a change to one of them re-requests it. */
  inputs: string[];
  bindings: { node: string; prop: string; path: string }[];
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

function isRecord(v: unknown): v is { [key: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function request(id: string, type: unknown, prop: string, binding: unknown, catalogue: IslandCatalogueJson): DataRequest | null {
  if (!isBinding(binding)) return null;
  const expects = typeof type === "string" ? expectedShape(catalogue, type, prop) : null;
  const out: DataRequest = { node: id, prop, path: binding.$bind, expects };
  if (isLiveBinding(binding)) out.source = binding.$source;
  const b = binding as unknown as Record<string, unknown>;
  if (has.call(b, "$params") && isRecord(b.$params)) out.params = b.$params;
  if (has.call(b, "$scope") && isRecord(b.$scope)) out.scope = b.$scope;
  return { node: out.node, prop: out.prop, path: out.path, ...(out.source ? { source: out.source } : {}), ...(out.params ? { params: out.params } : {}), ...(out.scope ? { scope: out.scope } : {}), expects };
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

/** `{ "$input": name }` and nothing else: a value taken from a page input. */
function inputRef(v: unknown): string | null {
  if (!isRecord(v)) return null;
  const keys = Object.keys(v);
  return keys.length === 1 && keys[0] === "$input" && typeof v.$input === "string" ? v.$input : null;
}

/** Each top-level value of `$params` / `$scope`, with input references replaced by the input's value (null when no such input). */
function withInputs(rec: { [key: string]: Json } | undefined, values: InputValues, used: Set<string>): { [key: string]: unknown } {
  const out: { [key: string]: unknown } = {};
  if (!rec) return out;
  for (const key of Object.keys(rec)) {
    const ref = inputRef(rec[key]);
    if (ref !== null && has.call(values, ref)) used.add(ref);
    out[key] = ref === null ? rec[key] : has.call(values, ref) ? values[ref] : null;
  }
  return out;
}

/** A JSON value with every object's keys sorted, for comparing two specs. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isRecord(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

/**
 * The repeat variables a binding at `id`'s `prop` can see: a repeater's `item`
 * and `index` for its descendants, and the `as` of a node's own `repeat` (for
 * its props) and of every ancestor's. A path starting with one is a row of an
 * enclosing query, not a query of its own.
 */
function repeatVars(doc: PageDoc, id: string, prop: string): Set<string> {
  const vars = new Set<string>();
  const nodes = doc.nodes as Record<string, unknown>;
  const asOf = (n: unknown) => {
    const repeat = isRecord(n) ? n.repeat : undefined;
    return isRecord(repeat) && typeof repeat.as === "string" && repeat.as !== "" ? repeat.as : null;
  };
  const self = nodes[id];
  if (prop !== "repeat.each" && asOf(self)) vars.add(asOf(self)!);
  let parent = isRecord(self) ? self.parent : null;
  for (let guard = 0; typeof parent === "string" && has.call(nodes, parent) && guard < 256; guard++) {
    const p = nodes[parent];
    if (asOf(p)) vars.add(asOf(p)!);
    if (isRecord(p) && p.type === "repeater") {
      vars.add("item");
      vars.add("index");
    }
    parent = isRecord(p) ? p.parent : null;
  }
  return vars;
}

export interface DataQueryOptions {
  /** Page input values by name (raw; normalised against the page's inputs). */
  inputs?: Record<string, unknown>;
  /** The data context bound input options resolve against. */
  data?: Record<string, unknown>;
  catalogue?: IslandCatalogueJson;
}

/**
 * What the host must fetch to render a document: one entry per distinct
 * `(stream, alias, params, scope)`, in the order the page first reads it.
 *
 * Every binding of one query shares its `$params` and `$scope`, so a binding
 * that states neither joins the first query on its key that does (or one with
 * none, if no binding states any). `{ "$input": name }` values are filled from
 * the page's current input values. fancy-cms never interprets a scope: the
 * host applies it against the viewer, and only it can narrow or refuse it.
 * The PHP twin is `FancyCms\Data\DataRequests::queries()`.
 */
export function dataQueries(doc: PageDoc, options: DataQueryOptions = {}): DataQuery[] {
  const values = inputValues(doc, options.inputs ?? {}, options.data);
  const requests = dataRequests(doc, options.catalogue ?? BUILTIN_ISLAND_CATALOGUE);
  const queries: (DataQuery & { sig: string | null })[] = [];
  const later: { key: string; binding: DataQuery["bindings"][number] }[] = [];
  const make = (key: string, params: DataQuery["params"], scope: DataQuery["scope"], inputs: Set<string>, sig: string | null) => {
    const hash = key.indexOf("#");
    const q = { key, stream: hash < 0 ? key : key.slice(0, hash), alias: hash < 0 ? null : key.slice(hash + 1), params, scope, inputs: [...inputs].sort(), bindings: [], sig };
    queries.push(q);
    return q;
  };
  for (const r of requests) {
    const key = r.path.split(".")[0]!;
    if (key === "" || repeatVars(doc, r.node, r.prop).has(key)) continue;
    const binding = { node: r.node, prop: r.prop, path: r.path };
    if (r.params === undefined && r.scope === undefined) {
      later.push({ key, binding });
      continue;
    }
    const used = new Set<string>();
    const params = withInputs(r.params, values, used);
    const scope = withInputs(r.scope, values, used);
    const sig = canonical([params, scope]);
    const q = queries.find((x) => x.key === key && x.sig === sig) ?? make(key, params, scope, used, sig);
    q.bindings.push(binding);
  }
  for (const { key, binding } of later) {
    const q = queries.find((x) => x.key === key) ?? make(key, {}, {}, new Set(), null);
    q.bindings.push(binding);
  }
  // Each query in the order the page first reads it, and its bindings in reading order.
  const at = new Map(requests.map((r, i) => [`${r.node}\u0000${r.prop}`, i]));
  const index = (b: DataQuery["bindings"][number]) => at.get(`${b.node}\u0000${b.prop}`)!;
  for (const q of queries) q.bindings.sort((a, b) => index(a) - index(b));
  return queries
    .sort((a, b) => index(a.bindings[0]!) - index(b.bindings[0]!))
    .map(({ sig: _sig, ...q }) => q);
}
