import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, type Node, type PageDoc } from "../src/document/types";
import { invert, reduce, reduceAll } from "../src/document/reduce";
import { CmsPage } from "../src/react/CmsPage";
import { emitDocCss } from "../src/render/css";
import { Icon } from "@particle-academy/react-fancy";
import { NativeIcon } from "../src/react/NativeIcon";
import allIcons from "../icons/all.js";

const names = ["arrow-right", "calculator", "check", "file-text", "quote", "receipt-text", "users"];
const icon = (props: Record<string, unknown> = {}): Node => ({ id: "icon", type: "icon", parent: null, order: "V", props: { name: "receipt-text", decorative: true, label: "", ...props } as Node["props"], style: { base: { fontSize: { value: 24, unit: "px" }, color: "var(--cms-color-primary)" }, md: { fontSize: { value: 32, unit: "px" } } } });
const doc = (props: Record<string, unknown> = {}): PageDoc => ({ ...emptyDoc("icons"), nodes: { icon: icon(props) } });
const html = (props: Record<string, unknown> = {}) => renderToStaticMarkup(<CmsPage doc={doc(props)} icons={allIcons} includeStyles={false} />);

describe("bounded native icons", () => {
  it.each(names)("renders %s synchronously with the Fancy Icon wrapper", (name) => {
    const markup = html({ name });
    expect(markup).toContain('data-react-fancy-icon=""');
    expect(markup).toContain("<svg");
    expect(markup).toContain('stroke="currentColor"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('role="img"');
  });
  it("matches the public Fancy Icon wrapper without requiring it at runtime", () => {
    const rendered = NativeIcon({ props: icon().props, icons: allIcons })!;
    const expected = renderToStaticMarkup(<Icon>{rendered.props.children}</Icon>);
    expect(renderToStaticMarkup(rendered)).toBe(expected);
  });
  it("exposes only an escaped meaningful label and hides decorative labels", () => {
    const label = 'Receipt <script> & "tax"';
    expect(html({ decorative: false, label })).toContain('role="img"');
    expect(html({ decorative: false, label })).toContain('aria-label="Receipt &lt;script&gt; &amp; &quot;tax&quot;"');
    expect(html({ label })).not.toContain("aria-label");
    const css = emitDocCss(doc());
    expect(css).toContain("font-size: 24px;");
    expect(css).toContain("font-size: 32px;");
    expect(css).toContain("color: var(--cms-color-primary);");
  });
  it.each([
    { name: "__proto__" }, { name: "constructor" }, { name: "toString" }, { name: "not-an-icon" },
    { name: '<svg onload="bad()">' }, { name: { $bind: "icon" } }, { decorative: "true" }, { decorative: null },
    { decorative: false, label: "  " }, { label: 3 }, { label: { $bind: "label" } }, { label: "é".repeat(513) },
    { svg: "<svg/>" }, { path: "M0 0" }, { onClick: "bad()" },
  ])("refuses unsafe or ambiguous icon props %j at both operation boundaries", (props) => {
    for (const [before, op] of [
      [emptyDoc("icons"), { t: "insert_node", node: icon(props) }],
      [doc(), { t: "set_node_props", id: "icon", patch: props }],
    ] as const) {
      const snapshot = JSON.stringify(before), invalid: string[] = [];
      expect(reduce(before, op, { onInvalid: (_, reason) => invalid.push(reason) })).toBe(before);
      expect(invalid).toEqual(["invalid icon props"]);
      expect(JSON.stringify(before)).toBe(snapshot);
    }
    expect(html(props)).not.toContain("<svg");
    expect(html(props)).not.toContain('role="img"');
  });
  it("keeps icons as leaves and undoes a valid name/accessibility edit", () => {
    const before = doc(), op = { t: "set_node_props", id: "icon", patch: { name: "calculator", decorative: false, label: "Tax estimate" } } as const;
    const changed = reduce(before, op);
    expect(changed.nodes.icon!.props.name).toBe("calculator");
    expect(reduceAll(changed, invert(before, op)).nodes).toEqual(before.nodes);
    const child: Node = { ...icon(), id: "child", type: "text", props: { content: "child" }, parent: "icon" };
    expect(reduce(before, { t: "insert_node", node: child })).toBe(before);
    const two = { ...before, nodes: { ...before.nodes, child: { ...child, parent: null } } };
    expect(reduce(two, { t: "move_node", id: "child", parent: "icon", order: "V" })).toBe(two);
  });
  it("wire-replays undo when a meaningful edit introduces an optional label", () => {
    const before = doc();
    delete before.nodes.icon!.props.label;
    const op = { t: "set_node_props", id: "icon", patch: { decorative: false, label: "Receipt" } } as const;
    const inverse = JSON.parse(JSON.stringify(invert(before, op)));
    expect(reduceAll(reduce(before, op), inverse).nodes).toEqual(before.nodes);
  });
  it("refuses omitted required props and inherited catalogue controls", () => {
    for (const key of ["name", "decorative"]) {
      const node = icon();
      delete node.props[key];
      const before = emptyDoc("icons");
      expect(reduce(before, { t: "insert_node", node })).toBe(before);
    }
    const node = icon();
    node.props = Object.create({ name: "check", decorative: true });
    const before = emptyDoc("icons");
    expect(reduce(before, { t: "insert_node", node })).toBe(before);
  });
  it("requires a meaningful label to be an own JSON property", () => {
    const node = icon();
    node.props = Object.assign(Object.create({ label: "Inherited label" }), { name: "check", decorative: false });
    const before = emptyDoc("icons");
    expect(reduce(before, { t: "insert_node", node })).toBe(before);
    expect(renderToStaticMarkup(<CmsPage doc={{ ...before, nodes: { icon: node } }} icons={allIcons} includeStyles={false} />)).not.toContain('role="img"');
  });
});
