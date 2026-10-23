import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, type Node, type PageDoc } from "../src/document/types";
import { reduce } from "../src/document/reduce";
import { emitDocCss } from "../src/render/css";
import { CmsPage } from "../src/react/CmsPage";

/*
 * Node ids are op-supplied, and an agent writes the ops. A plain-object node
 * map answered `doc.nodes["constructor"]` with Object.prototype's constructor,
 * so: inserting a node called "constructor" was refused as a duplicate,
 * removing an absent "toString" "succeeded" and bumped seq, and writing
 * `nodes["__proto__"] = node` replaced the map's prototype instead of adding a
 * node. Found by the PHP port of the reducer, which has no prototype to see.
 */

const mk = (id: string, parent: string | null = null, extra: Partial<Node> = {}): Node => ({
  id,
  type: "section",
  parent,
  order: "a0",
  props: {},
  style: { base: {} },
  ...extra,
});

const ids = ["constructor", "toString", "hasOwnProperty", "__proto__"];

describe("node ids that are also Object.prototype names", () => {
  it.each(ids)("a node called %s can be inserted, found and removed", (id) => {
    let doc = emptyDoc("p");
    doc = reduce(doc, { t: "insert_node", node: mk(id) });
    expect(Object.prototype.hasOwnProperty.call(doc.nodes, id)).toBe(true);
    expect(doc.seq).toBe(1);
    // The map is still an ordinary object: its prototype was not replaced.
    expect(Object.getPrototypeOf(doc.nodes)).toBe(Object.prototype);

    doc = reduce(doc, { t: "set_node_props", id, patch: { content: "x" } });
    expect(doc.nodes[id]!.props).toEqual({ content: "x" });
    expect(doc.seq).toBe(2);

    doc = reduce(doc, { t: "remove_node", id });
    expect(Object.prototype.hasOwnProperty.call(doc.nodes, id)).toBe(false);
    expect(doc.seq).toBe(3);
  });

  it.each(ids)("an op on an ABSENT %s is refused and changes nothing", (id) => {
    const doc = emptyDoc("p");
    for (const op of [
      { t: "remove_node", id },
      { t: "set_node_props", id, patch: { a: 1 } },
      { t: "set_style", id, breakpoint: "base", patch: { color: "#fff" } },
      { t: "set_layout", id, layout: "stack" },
      { t: "move_node", id, parent: null, order: "b0" },
    ] as const) {
      expect(reduce(doc, op as never)).toBe(doc);
    }
  });

  it("a child cannot be inserted under an absent parent called constructor", () => {
    const doc = emptyDoc("p");
    expect(reduce(doc, { t: "insert_node", node: mk("child", "constructor") })).toBe(doc);
  });

  it("the renderer and the CSS emitter handle such ids", () => {
    let doc: PageDoc = emptyDoc("p");
    doc = reduce(doc, { t: "insert_node", node: mk("constructor", null, { style: { base: { color: "#111111" } } }) });
    expect(emitDocCss(doc)).toContain('[data-cms="constructor"]');
    expect(renderToStaticMarkup(<CmsPage doc={doc} includeStyles={false} />)).toContain('data-cms="constructor"');
  });
});
