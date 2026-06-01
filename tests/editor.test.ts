import { describe, expect, it } from "vitest";
import { emptyDoc, type Node } from "../src/document/types";
import { editorReduce, initEditor } from "../src/editor/state";

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

const insert = (id: string, parent: string | null, order: string) =>
  ({ type: "apply", op: { t: "insert_node", node: mkNode(id, parent, order) } }) as const;

describe("editorReduce", () => {
  it("applies an op, advances the doc, and records history", () => {
    const s0 = initEditor(emptyDoc("p1"));
    const s1 = editorReduce(s0, insert("s1", null, "a"));
    expect(s1.doc.sections).toEqual(["s1"]);
    expect(s1.past).toHaveLength(1);
    expect(s1.future).toHaveLength(0);
  });

  it("ignores a no-op (invalid) op with no history entry", () => {
    const s = editorReduce(initEditor(emptyDoc("p1")), insert("s1", null, "a"));
    const after = editorReduce(s, { type: "apply", op: { t: "remove_node", id: "ghost" } });
    expect(after).toBe(s);
  });

  it("undo and redo walk the snapshot history", () => {
    let s = initEditor(emptyDoc("p1"));
    s = editorReduce(s, insert("s1", null, "a"));
    s = editorReduce(s, insert("s2", null, "b"));
    expect(s.doc.sections).toEqual(["s1", "s2"]);

    s = editorReduce(s, { type: "undo" });
    expect(s.doc.sections).toEqual(["s1"]);
    expect(s.future).toHaveLength(1);

    s = editorReduce(s, { type: "redo" });
    expect(s.doc.sections).toEqual(["s1", "s2"]);
  });

  it("clears the redo future when a new op is applied after undo", () => {
    let s = initEditor(emptyDoc("p1"));
    s = editorReduce(s, insert("s1", null, "a"));
    s = editorReduce(s, { type: "undo" });
    expect(s.future).toHaveLength(1);
    s = editorReduce(s, insert("s2", null, "b"));
    expect(s.future).toHaveLength(0);
  });

  it("tracks selection", () => {
    const s = editorReduce(initEditor(emptyDoc("p1")), { type: "select", id: "x" });
    expect(s.selection).toBe("x");
  });
});
