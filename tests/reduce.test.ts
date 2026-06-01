import { describe, expect, it, vi } from "vitest";
import { emptyDoc, type Node, type PageDoc } from "../src/document/types";
import { childrenOf, invert, reduce, reduceAll } from "../src/document/reduce";
import { keyBetween } from "../src/document/fractional";
import { emitDocCss } from "../src/render/css";

function mkNode(id: string, parent: string | null, order: string, extra: Partial<Node> = {}): Node {
  return {
    id,
    type: extra.type ?? "section",
    parent,
    order,
    props: extra.props ?? {},
    style: extra.style ?? { base: {} },
    ...extra,
  };
}

function seed(): PageDoc {
  let doc = emptyDoc("p1");
  doc = reduce(doc, { t: "insert_node", node: mkNode("s1", null, "a") });
  doc = reduce(doc, { t: "insert_node", node: mkNode("s2", null, "b") });
  doc = reduce(doc, { t: "insert_node", node: mkNode("t1", "s1", "a", { type: "text" }) });
  return doc;
}

describe("reduce", () => {
  it("inserts nodes and tracks top-level order + seq", () => {
    const doc = seed();
    expect(Object.keys(doc.nodes).sort()).toEqual(["s1", "s2", "t1"]);
    expect(doc.sections).toEqual(["s1", "s2"]);
    expect(doc.seq).toBe(3);
    expect(childrenOf(doc, "s1").map((n) => n.id)).toEqual(["t1"]);
  });

  it("is a no-op on an invalid op (seq unchanged, onInvalid fired)", () => {
    const doc = seed();
    const onInvalid = vi.fn();
    const next = reduce(doc, { t: "insert_node", node: mkNode("s1", null, "z") }, { onInvalid });
    expect(next).toBe(doc); // same reference
    expect(next.seq).toBe(doc.seq);
    expect(onInvalid).toHaveBeenCalledOnce();
  });

  it("removes a node and cascades to descendants", () => {
    const doc = seed();
    const next = reduce(doc, { t: "remove_node", id: "s1" });
    expect(Object.keys(next.nodes).sort()).toEqual(["s2"]);
    expect(next.sections).toEqual(["s2"]);
  });

  it("moves a node and prevents cycles", () => {
    let doc = seed();
    doc = reduce(doc, { t: "move_node", id: "t1", parent: "s2", order: "a" });
    expect(doc.nodes.t1!.parent).toBe("s2");
    const onInvalid = vi.fn();
    const blocked = reduce(doc, { t: "move_node", id: "s2", parent: "t1", order: "a" }, { onInvalid });
    expect(blocked).toBe(doc);
    expect(onInvalid).toHaveBeenCalledOnce();
  });

  it("merges per-breakpoint style patches", () => {
    let doc = seed();
    doc = reduce(doc, { t: "set_style", id: "t1", breakpoint: "base", patch: { color: "#fff" } });
    doc = reduce(doc, { t: "set_style", id: "t1", breakpoint: "base", patch: { opacity: 0.5 } });
    expect(doc.nodes.t1!.style.base).toEqual({ color: "#fff", opacity: 0.5 });
  });

  it("reorders sections only with a valid permutation", () => {
    const doc = seed();
    const ok = reduce(doc, { t: "reorder_sections", order: ["s2", "s1"] });
    expect(ok.sections).toEqual(["s2", "s1"]);
    const onInvalid = vi.fn();
    const bad = reduce(doc, { t: "reorder_sections", order: ["s1", "x"] }, { onInvalid });
    expect(bad).toBe(doc);
    expect(onInvalid).toHaveBeenCalledOnce();
  });
});

describe("invert (undo)", () => {
  it("round-trips insert → remove", () => {
    const doc = seed();
    const op = { t: "insert_node", node: mkNode("s3", null, "c") } as const;
    const next = reduce(doc, op);
    const back = reduceAll(next, invert(doc, op));
    expect(back.nodes).toEqual(doc.nodes);
    expect(back.sections).toEqual(doc.sections);
  });

  it("round-trips a move", () => {
    const doc = seed();
    const op = { t: "move_node", id: "t1", parent: "s2", order: "m" } as const;
    const next = reduce(doc, op);
    const back = reduceAll(next, invert(doc, op));
    expect(back.nodes.t1!.parent).toBe("s1");
    expect(back.nodes.t1!.order).toBe("a");
  });
});

describe("keyBetween", () => {
  it("produces strictly-increasing keys", () => {
    const first = keyBetween(null, null);
    const append = keyBetween(first, null);
    const prepend = keyBetween(null, first);
    const middle = keyBetween(first, append);
    expect(prepend < first).toBe(true);
    expect(first < middle).toBe(true);
    expect(middle < append).toBe(true);
  });

  it("stays ordered across many inserts at the front", () => {
    const keys: string[] = [];
    let hi: string | null = null;
    for (let i = 0; i < 25; i++) {
      const k = keyBetween(null, hi);
      keys.unshift(k);
      hi = k;
    }
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });
});

describe("emitDocCss", () => {
  it("is deterministic and emits sorted decls + media queries", () => {
    let doc = emptyDoc("p1");
    doc = reduce(doc, { t: "insert_node", node: mkNode("s1", null, "a", { layout: "stack" }) });
    doc = reduce(doc, {
      t: "insert_node",
      node: mkNode("t1", "s1", "a", {
        type: "text",
        style: {
          base: { color: "#0f172a", fontSize: { value: 24, unit: "px" } },
          md: { fontSize: { value: 40, unit: "px" } },
        },
      }),
    });

    const css = emitDocCss(doc);
    expect(css).toBe(emitDocCss(doc)); // deterministic
    expect(css).toContain('[data-cms="t1"] {');
    expect(css).toContain("color: #0f172a;");
    expect(css).toContain("font-size: 24px;");
    expect(css).toContain("@media (min-width: 768px) {");
    // declarations are alphabetically sorted within a rule
    expect(css.indexOf("color:")).toBeLessThan(css.indexOf("font-size:"));
  });
});
