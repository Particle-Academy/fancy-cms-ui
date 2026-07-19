// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { emptyDoc, type PageDoc } from "../src/document/types";
import { reduce } from "../src/document/reduce";
import { buildInsertOp, resolveInsertParent, ADD_MENU } from "../src/editor/insert";
import { Editor } from "../src/editor/Editor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(el: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return { host, unmount: () => act(() => root.unmount()) };
}

describe("buildInsertOp", () => {
  it("places the first element at the top level of an empty page", () => {
    // The crux of #3: an empty doc has no sections, so there is nothing to
    // select and nothing to nest into. Insertion must still land somewhere.
    const doc = emptyDoc("p1");
    const { op, id } = buildInsertOp(doc, "heading", null);
    const next = reduce(doc, op);

    expect(next.nodes[id]).toBeDefined();
    expect(next.nodes[id]!.parent).toBeNull();
    expect(next.nodes[id]!.type).toBe("heading");
  });

  it("nests into the selected node when that node is a container", () => {
    let doc = emptyDoc("p1");
    const first = buildInsertOp(doc, "card", null);
    doc = reduce(doc, first.op);

    const child = buildInsertOp(doc, "text", first.id);
    doc = reduce(doc, child.op);

    expect(doc.nodes[child.id]!.parent).toBe(first.id);
  });

  it("inserts alongside the selection when the selected node is a leaf", () => {
    let doc = emptyDoc("p1");
    const card = buildInsertOp(doc, "card", null);
    doc = reduce(doc, card.op);
    const text = buildInsertOp(doc, "text", card.id);
    doc = reduce(doc, text.op);

    // Selecting the leaf `text` should add a sibling inside the card, not a
    // child of the text node.
    const sibling = buildInsertOp(doc, "button", text.id);
    doc = reduce(doc, sibling.op);

    expect(doc.nodes[sibling.id]!.parent).toBe(card.id);
  });

  it("gives every inserted node a distinct id and an increasing order key", () => {
    let doc = emptyDoc("p1");
    const ids: string[] = [];
    const orders: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { op, id } = buildInsertOp(doc, "text", null);
      doc = reduce(doc, op);
      ids.push(id);
      orders.push(doc.nodes[id]!.order);
    }
    expect(new Set(ids).size).toBe(3);
    expect([...orders].sort()).toEqual(orders);
  });

  it("honours an explicit target over the selection", () => {
    let doc = emptyDoc("p1");
    const a = buildInsertOp(doc, "card", null);
    doc = reduce(doc, a.op);
    const b = buildInsertOp(doc, "card", null);
    doc = reduce(doc, b.op);

    // Selection says card A; the drop target says card B — target wins.
    const dropped = buildInsertOp(doc, "text", a.id, b.id);
    doc = reduce(doc, dropped.op);
    expect(doc.nodes[dropped.id]!.parent).toBe(b.id);
  });

  it("builds an op for every kind the menu offers", () => {
    // A menu entry with no matching default would insert an undefined type.
    const doc = emptyDoc("p1");
    for (const item of ADD_MENU) {
      const { op, id } = buildInsertOp(doc, item.kind, null);
      const next = reduce(doc, op);
      expect(next.nodes[id]?.type, item.kind).toBeTruthy();
    }
  });
});

describe("resolveInsertParent", () => {
  it("returns null for an empty page", () => {
    expect(resolveInsertParent(emptyDoc("p1"), null)).toBeNull();
  });

  it("falls back to the last section when nothing is selected", () => {
    let doc = emptyDoc("p1");
    const section = buildInsertOp(doc, "stack", null);
    doc = reduce(doc, section.op);
    doc = { ...doc, sections: [section.id] } as PageDoc;
    expect(resolveInsertParent(doc, null)).toBe(section.id);
  });
});

describe("<Editor> insert affordance", () => {
  it("renders an add control", () => {
    const { host, unmount } = mount(<Editor defaultValue={emptyDoc("p1")} />);
    expect(host.querySelector("[data-cms-add-trigger]")).not.toBeNull();
    unmount();
  });

  it("opens a menu listing every element kind", () => {
    const { host, unmount } = mount(<Editor defaultValue={emptyDoc("p1")} />);
    const trigger = host.querySelector<HTMLButtonElement>("[data-cms-add-trigger]")!;
    act(() => trigger.click());
    expect(host.querySelectorAll("[data-cms-add]").length).toBe(ADD_MENU.length);
    unmount();
  });

  it("adds an element to an empty document and reports it via onChange", () => {
    // End to end: this is what was impossible before — authoring a page from
    // emptyDoc() through the standalone editor.
    const seen: PageDoc[] = [];
    const { host, unmount } = mount(<Editor defaultValue={emptyDoc("p1")} onChange={(d) => seen.push(d)} />);

    act(() => host.querySelector<HTMLButtonElement>("[data-cms-add-trigger]")!.click());
    act(() => host.querySelector<HTMLButtonElement>('[data-cms-add="heading"]')!.click());

    const latest = seen.at(-1);
    expect(latest).toBeDefined();
    const added = Object.values(latest!.nodes);
    expect(added).toHaveLength(1);
    expect(added[0]!.type).toBe("heading");
    unmount();
  });

  it("renders an empty page instead of throwing when defaultValue is omitted", () => {
    // Previously: TypeError reading 'sections' of undefined.
    const { host, unmount } = mount(<Editor />);
    expect(host.querySelector("[data-cms-add-trigger]")).not.toBeNull();
    unmount();
  });
});
