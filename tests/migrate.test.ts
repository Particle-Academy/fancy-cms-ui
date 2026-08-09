import { describe, expect, it } from "vitest";
import { emptyDoc, type Node, type PageDoc } from "../src/document/types";
import { rootIds } from "../src/document/reduce";
import { type LegacyPageDoc, migrateDoc, migrateDocVerbose, needsMigration } from "../src/document/migrate";

function mkNode(id: string, parent: string | null, order: string): Node {
  return { id, type: "section", parent, order, props: {}, style: {} };
}

/** A document as it was persisted under the old model. */
function legacy(sections: string[], nodes: Node[]): LegacyPageDoc {
  const doc = emptyDoc("p1") as LegacyPageDoc;
  doc.sections = sections;
  doc.nodes = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return doc;
}

describe("migrateDoc", () => {
  it("is the whole point: recovers an order that the order keys had lost", () => {
    // The old `reorder_sections` permuted `sections[]` and left every `order`
    // key alone. So a page the user dragged into c, a, b is stored with keys
    // that still say a, b, c — and `sections[]` is the only record of the truth.
    // Falling back to the keys here would silently un-reorder a live page.
    const doc = legacy(
      ["c", "a", "b"],
      [mkNode("a", null, "a0"), mkNode("b", null, "a1"), mkNode("c", null, "a2")],
    );

    expect(rootIds(migrateDoc(doc))).toEqual(["c", "a", "b"]);
  });

  it("drops the legacy array", () => {
    const doc = legacy(["a"], [mkNode("a", null, "a0")]);
    const out = migrateDoc(doc) as LegacyPageDoc;

    expect(out.sections).toBeUndefined();
    expect("sections" in out).toBe(false);
  });

  it("leaves an already-migrated document untouched, by reference", () => {
    // Lets a host call this unconditionally on load instead of tracking a
    // schema version.
    const doc: PageDoc = { ...emptyDoc("p1"), nodes: { a: mkNode("a", null, "a0") } };

    expect(needsMigration(doc)).toBe(false);
    expect(migrateDoc(doc)).toBe(doc);
  });

  it("is idempotent", () => {
    const once = migrateDoc(legacy(["c", "a"], [mkNode("a", null, "a0"), mkNode("c", null, "a2")]));
    const twice = migrateDoc(once);

    expect(twice).toBe(once);
    expect(rootIds(twice)).toEqual(["c", "a"]);
  });

  it("skips ids with no node rather than faulting the document", () => {
    const doc = legacy(["a", "ghost", "b"], [mkNode("a", null, "a0"), mkNode("b", null, "a1")]);
    const r = migrateDocVerbose(doc);

    expect(r.danglingIds).toEqual(["ghost"]);
    expect(rootIds(r.doc)).toEqual(["a", "b"]);
  });

  it("appends roots the array never listed instead of losing them", () => {
    // Under the old model these did not render at all — being absent from
    // `sections[]` made a root invisible. Surfacing one is recoverable;
    // deleting it is not.
    const doc = legacy(
      ["b"],
      [mkNode("a", null, "a0"), mkNode("b", null, "a1"), mkNode("z", null, "a5")],
    );
    const r = migrateDocVerbose(doc);

    expect(r.unlistedRootIds).toEqual(["a", "z"]);
    expect(rootIds(r.doc)).toEqual(["b", "a", "z"]);
  });

  it("takes the first occurrence of a duplicated id", () => {
    const doc = legacy(["a", "b", "a"], [mkNode("a", null, "a0"), mkNode("b", null, "a1")]);

    expect(rootIds(migrateDoc(doc))).toEqual(["a", "b"]);
  });

  it("does not touch non-root nodes", () => {
    const child = mkNode("t1", "a", "a3");
    const doc = legacy(["a"], [mkNode("a", null, "a0"), child]);
    const out = migrateDoc(doc);

    expect(out.nodes.t1).toEqual(child);
  });

  it("mints strictly increasing keys, so a later insert still lands correctly", () => {
    const doc = migrateDoc(
      legacy(["c", "a", "b"], [mkNode("a", null, "a0"), mkNode("b", null, "a1"), mkNode("c", null, "a2")]),
    );
    const keys = rootIds(doc).map((id) => doc.nodes[id]!.order);

    expect([...keys].sort()).toEqual(keys);
  });

  it("handles an empty document", () => {
    const r = migrateDocVerbose(legacy([], []));

    expect(r.migrated).toBe(true);
    expect(rootIds(r.doc)).toEqual([]);
  });
});
