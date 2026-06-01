import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, type Node, type PageDoc } from "../src/document/types";
import { reduce } from "../src/document/reduce";
import { CmsPage } from "../src/react/CmsPage";
import { CmsRegion } from "../src/react/CmsRegion";

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

function build(): PageDoc {
  let doc = emptyDoc("p1");
  doc = reduce(doc, {
    t: "insert_node",
    node: mkNode("s1", null, "a", { layout: "stack", style: { base: { background: "#ffffff" } } }),
  });
  doc = reduce(doc, {
    t: "insert_node",
    node: mkNode("t1", "s1", "a", { type: "text", props: { content: "Hello" }, style: { base: { color: "#000000" } } }),
  });
  doc = reduce(doc, {
    t: "insert_node",
    node: mkNode("img1", "s1", "b", { type: "image", props: { src: "/logo.jpg" } }),
  });
  doc = reduce(doc, {
    t: "insert_node",
    node: mkNode("chart1", "s1", "c", { type: "chart", island: true }),
  });
  return doc;
}

describe("CmsPage", () => {
  it("renders sections, data-cms handles, text, images, and injected styles", () => {
    const html = renderToStaticMarkup(<CmsPage doc={build()} />);
    expect(html).toContain('data-cms="s1"');
    expect(html).toContain('data-cms="t1"');
    expect(html).toContain("Hello");
    expect(html).toContain('src="/logo.jpg"');
    expect(html).toContain("<style");
    expect(html).toContain('[data-cms="t1"]'); // emitted CSS present
  });

  it("renders an island as an empty, hydratable placeholder", () => {
    const html = renderToStaticMarkup(<CmsPage doc={build()} includeStyles={false} />);
    expect(html).toContain('data-cms-island="chart"');
    // the island wrapper carries no inner content (host hydrates it)
    expect(html).toContain('<div data-cms="chart1" data-cms-island="chart"></div>');
  });
});

describe("CmsRegion", () => {
  it("renders a single subtree by root id", () => {
    let doc = emptyDoc("p1");
    doc = reduce(doc, { t: "insert_node", node: mkNode("s1", null, "a") });
    doc = reduce(doc, { t: "insert_node", node: mkNode("s2", null, "b") });
    doc = reduce(doc, { t: "insert_node", node: mkNode("t2", "s2", "a", { type: "text", props: { content: "Region" } }) });
    const html = renderToStaticMarkup(<CmsRegion doc={doc} root="s2" includeStyles={false} />);
    expect(html).toContain('data-cms="s2"');
    expect(html).toContain("Region");
    expect(html).not.toContain('data-cms="s1"');
  });
});
