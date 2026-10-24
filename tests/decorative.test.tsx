import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, type Node } from "../src/document/types";
import { invert, reduce, reduceAll } from "../src/document/reduce";
import { CmsPage } from "../src/react/CmsPage";
import { CmsRegion } from "../src/react/CmsRegion";
import { RenderNode } from "../src/react/RenderNode";
import { decorationError } from "../src/document/decorative";

const node = (id: string, type = "frame", parent: string | null = null, props: Node["props"] = {}): Node => ({ id, type, parent, order: "V", props, style: { base: {} } });
const doc = (...nodes: Node[]) => ({ ...emptyDoc("decoration"), nodes: Object.fromEntries(nodes.map((item) => [item.id, item])) });

describe("decorative compositions cannot hide meaningful content", () => {
  it.each(["frame", "shape"])("only accepts a literal boolean on %s", (type) => {
    for (const flag of [true, false]) {
      const page = doc(node("art", type, null, { decorative: flag }));
      expect(renderToStaticMarkup(<CmsPage doc={page} includeStyles={false} />).includes('aria-hidden="true"')).toBe(flag);
    }
    for (const flag of ["true", null, 1, { $bind: "flag" }]) {
      const before = emptyDoc("decorative");
      expect(reduce(before, { t: "insert_node", node: node("art", type, null, { decorative: flag }) })).toBe(before);
      const withFrame = doc(node("art", type));
      const invalid: string[] = [];
      expect(reduce(withFrame, { t: "set_node_props", id: "art", patch: { decorative: flag } }, { onInvalid: (_, reason) => invalid.push(reason) })).toBe(withFrame);
      expect(invalid).toEqual(["invalid decorative props"]);
    }
    const before = doc(node("link", "link", null, { href: "/pricing", content: "Pricing" }));
    expect(reduce(before, { t: "set_node_props", id: "link", patch: { decorative: true } })).toBe(before);
  });
  it.each(["text", "heading", "richtext", "link", "button", "list", "image", "callout", "code", "card", "stack", "repeater", "host-widget"])("refuses insertion/move/wrapping of %s", (type) => {
    const art = node("art", "frame", null, { decorative: true }), nested = node("nested", "shape", "art");
    const content = node("content", type, "nested", { content: "Visible content", alt: "Meaningful image" });
    let before = doc(art, nested);
    expect(reduce(before, { t: "insert_node", node: content })).toBe(before);
    before = doc(art, nested, { ...content, parent: null });
    expect(reduce(before, { t: "move_node", id: "content", parent: "nested", order: "V" })).toBe(before);
    before = doc({ ...art, props: { decorative: false } }, nested, content);
    expect(reduce(before, { t: "set_node_props", id: "art", patch: { decorative: true } })).toBe(before);
  });
  it("refuses moving a meaningful subtree and making a nested icon meaningful", () => {
    let before = doc(node("art", "frame", null, { decorative: true }), node("group"), node("cta", "button", "group", { label: "Trial", href: "/signup" }));
    expect(reduce(before, { t: "move_node", id: "group", parent: "art", order: "Z" })).toBe(before);
    before = doc(...Object.values(before.nodes), node("glyph", "icon", "art", { name: "check", decorative: true, label: "Check" }));
    expect(reduce(before, { t: "set_node_props", id: "glyph", patch: { decorative: false } })).toBe(before);
    before.nodes.glyph!.props.decorative = false;
    expect(decorationError(before.nodes)).toBe("decorative subtree contains meaningful content");
  });
  it("fails visible at every rendering entry if a stored subtree bypasses reducers", () => {
    const page = doc(node("art", "frame", null, { decorative: true }), node("shape", "shape", "art"));
    const renderings = () => [<CmsPage doc={page} includeStyles={false} />, <CmsRegion doc={page} root="art" includeStyles={false} />, <RenderNode doc={page} id="art" />].map((element) => renderToStaticMarkup(element));
    expect(renderings().every((html) => html.includes('data-cms="art" aria-hidden="true"'))).toBe(true);
    page.nodes.cta = node("cta", "button", "shape", { label: "Start trial", href: "/signup" });
    for (const html of renderings()) { expect(html).toContain("Start trial"); expect(html).not.toContain("aria-hidden"); }
    delete page.nodes.cta;
    expect(renderings().every((html) => html.includes('aria-hidden="true"'))).toBe(true);
  });
  it("wire-undo restores the absent flag and every descendant", () => {
    const before = doc(node("art"), node("shape", "shape", "art"));
    const op = { t: "set_node_props", id: "art", patch: { decorative: true } } as const;
    const inverse = JSON.parse(JSON.stringify(invert(before, op)));
    expect(reduceAll(reduce(before, op), inverse).nodes).toEqual(before.nodes);
  });
  it("refuses actionable native shapes, including actions added after insertion", () => {
    const action = { on: "click", do: { kind: "navigate", href: "/signup" } } as const;
    const before = doc(node("art", "frame", null, { decorative: true }), node("shape", "shape", "art"));
    expect(reduce(before, { t: "set_action", id: "shape", index: 0, action })).toBe(before);
    const active = { ...node("active", "shape", "art"), actions: [action] };
    expect(reduce(before, { t: "insert_node", node: active })).toBe(before);
    const raw = doc(...Object.values(before.nodes), active);
    expect(decorationError(raw.nodes)).toBe("decorative subtree contains meaningful content");
    expect(renderToStaticMarkup(<CmsPage doc={raw} includeStyles={false} />)).not.toContain("aria-hidden");
    raw.nodes.active!.parent = null;
    expect(reduce(raw, { t: "move_node", id: "active", parent: "art", order: "Z" })).toBe(raw);
  });
  it("checks deep decorations iteratively and accepts only empty passive structure", () => {
    const nodes = Array.from({ length: 1500 }, (_, i) => node(`n${i}`, "frame", i ? `n${i - 1}` : null, { decorative: true }));
    const before = doc(...nodes);
    expect(decorationError(before.nodes)).toBeNull();
    expect(reduce(before, { t: "insert_node", node: node("cta", "button", "n1499", { label: "Trial" }) })).toBe(before);
    expect(decorationError(null)).not.toBeNull();
  });
});
