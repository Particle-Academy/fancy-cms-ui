import { describe, expect, it } from "vitest";

import { emptyDoc, isBinding, type Node, type PageDoc } from "../src/document/types";
import { bindingSources, isLiveBinding } from "../src/document/bindings";

function docWith(nodes: Record<string, Partial<Node>>): PageDoc {
  const doc = emptyDoc("p1");
  for (const [id, n] of Object.entries(nodes)) {
    doc.nodes[id] = {
      id,
      parent: null,
      order: "a0",
      type: "text",
      style: {},
      props: {},
      ...n,
    } as Node;
  }
  return doc;
}

/**
 * A bound node must name WHERE its data comes from — story #171, AC2.
 *
 * `{ $bind: "profile.coins" }` is a path into an opaque blob the host supplies.
 * It says nothing about which query produced that blob, so nothing can know what
 * to re-render when the underlying data changes. A host wiring live data had to
 * guess, per page, by hand.
 *
 * `$source` names it in the **Live Contract's** vocabulary — the same
 * `[namespace, resource, …]` key shape `fancy-query`'s `liveKey()` produces and
 * every backend twin declares its events against. That is the whole reason this
 * work was gated behind workstream A: had the substrate invented its own name
 * for "where this data lives", the wrong vocabulary would have been baked into
 * every saved document, which is far harder to walk back than a type.
 *
 * It is a plain array on purpose — structurally a TanStack `QueryKey` without
 * importing one. No Fancy package may take a TanStack dependency, and a saved
 * document must survive JSON.
 */
describe("binding sources", () => {
  it("keeps a plain binding valid and source-less", () => {
    // Backwards compatibility is the point: every document saved before this
    // has no $source, and a host-supplied static context is still legitimate.
    const b = { $bind: "profile.coins" };

    expect(isBinding(b)).toBe(true);
    expect(isLiveBinding(b)).toBe(false);
  });

  it("recognises a binding that names its source", () => {
    const b = { $bind: "products.0.name", $source: ["catalog", "products"] };

    expect(isBinding(b)).toBe(true);
    expect(isLiveBinding(b)).toBe(true);
  });

  it("collects every distinct source in a document", () => {
    // What a host actually needs: given this page, which live queries does it
    // depend on? Answering that by hand per page is what this replaces.
    const doc = docWith({
      a: { props: { text: { $bind: "p.name", $source: ["catalog", "products"] } } },
      b: { props: { text: { $bind: "p.price", $source: ["catalog", "products"] } } },
      c: { props: { text: { $bind: "u.coins", $source: ["mlm", "wallet"] } } },
    });

    const sources = bindingSources(doc);

    expect(sources).toHaveLength(2);
    expect(sources).toContainEqual(["catalog", "products"]);
    expect(sources).toContainEqual(["mlm", "wallet"]);
  });

  it("finds sources on a repeater's `each`", () => {
    // A repeater is the densest data dependency in the model — it renders once
    // per item. Missing it would leave exactly the node that most needs
    // invalidating unsubscribed.
    const doc = docWith({
      list: {
        type: "stack",
        repeat: { each: { $bind: "items", $source: ["catalog", "products"] }, as: "item" },
      },
    });

    expect(bindingSources(doc)).toContainEqual(["catalog", "products"]);
  });

  it("ignores literals and source-less bindings", () => {
    const doc = docWith({
      a: { props: { text: "just a string" } },
      b: { props: { text: { $bind: "host.value" } } },
    });

    expect(bindingSources(doc)).toEqual([]);
  });

  it("survives a JSON round trip", () => {
    // Sources live in SAVED documents. Anything that does not survive
    // serialisation is not a document field, whatever the type says.
    const doc = docWith({
      a: { props: { text: { $bind: "p.name", $source: ["catalog", "products"] } } },
    });

    const round = JSON.parse(JSON.stringify(doc)) as PageDoc;

    expect(bindingSources(round)).toContainEqual(["catalog", "products"]);
  });

  it("treats a malformed source as absent rather than throwing", () => {
    // Documents arrive from a database and from agents. A renderer that throws
    // on a bad field takes the whole page down; one that ignores it renders the
    // literal, which is what an unbound node does anyway.
    const doc = docWith({
      a: { props: { text: { $bind: "x", $source: "catalog.products" as never } } },
      b: { props: { text: { $bind: "y", $source: [] as never } } },
    });

    expect(bindingSources(doc)).toEqual([]);
  });
});
