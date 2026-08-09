/**
 * Where a bound value's data comes from.
 *
 * `{ $bind: "profile.coins" }` is a path into whatever blob the host passes as
 * `data`. It says nothing about which query produced that blob, so nothing could
 * know what to re-render when the underlying data changed — a host wiring live
 * data had to work it out per page, by hand.
 *
 * `$source` names it in the **Live Contract's** vocabulary: the same
 * `[namespace, resource, …]` key shape `fancy-query`'s `liveKey()` produces and
 * every backend twin declares its broadcast events against. So a CMS page's data
 * dependency is stated in the same words as `fancy-flow`'s or `laravel-catalog`'s,
 * and a host can subscribe to it without a CMS-specific mapping.
 *
 * This is why the story gated this work behind workstream A. Had the substrate
 * invented its own name for "where this data lives", that vocabulary would have
 * been baked into every saved document — much harder to walk back than a type,
 * and the same mistake the doc-commons effort exists to undo, one layer down.
 *
 * **Deliberately a plain array.** It is structurally a TanStack `QueryKey`
 * without importing one: no Fancy package may take a TanStack dependency, and a
 * field that does not survive `JSON.stringify` is not a document field whatever
 * its type says.
 */
import type { Binding, Json, Node, PageDoc } from "./types";
import { isBinding } from "./types";

/** A live query key: `["catalog", "products"]`. */
export type BindingSource = readonly (string | number)[];

/** A binding that names where its data comes from. */
export interface LiveBinding extends Binding {
  $source: BindingSource;
}

function isSource(v: unknown): v is BindingSource {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((seg) => typeof seg === "string" || typeof seg === "number")
  );
}

/**
 * Does this binding name a live source?
 *
 * A malformed `$source` reads as absent rather than throwing. Documents arrive
 * from a database and from agents; a renderer that throws on a bad field takes
 * the whole page down, where ignoring it renders the literal — which is exactly
 * what an unbound node does anyway.
 */
export function isLiveBinding(v: unknown): v is LiveBinding {
  return isBinding(v) && isSource((v as Partial<LiveBinding>).$source);
}

function eachBinding(value: unknown, visit: (b: Binding) => void): void {
  if (isBinding(value)) {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) eachBinding(item, visit);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value as Record<string, Json>)) eachBinding(item, visit);
  }
}

/**
 * Every distinct live source a document depends on.
 *
 * The question a host actually has: *given this page, which live queries does it
 * read?* Answering it by hand, per page, is what this replaces.
 *
 * Walks `props` and a node's `repeat.each` — the repeater is the densest data
 * dependency in the model, since it renders once per item, so missing it would
 * leave the node that most needs invalidating unsubscribed.
 */
export function bindingSources(doc: PageDoc): BindingSource[] {
  const seen = new Map<string, BindingSource>();

  const take = (b: Binding) => {
    if (!isLiveBinding(b)) return;
    // Keyed by serialized form so ["a","b"] from two nodes counts once.
    seen.set(JSON.stringify(b.$source), b.$source);
  };

  for (const node of Object.values(doc.nodes) as Node[]) {
    eachBinding(node.props, take);
    if (node.repeat?.each) eachBinding(node.repeat.each, take);
  }

  return [...seen.values()];
}
