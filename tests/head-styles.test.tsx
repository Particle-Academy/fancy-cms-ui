// @vitest-environment jsdom
/**
 * K20: a page's stylesheet belongs in <head>. CmsPage and CmsRegion used to
 * render `<style data-cms-styles>` beside the page's nodes, so under Inertia it
 * sat inside `<div id="app">`, which is invalid HTML on every page.
 */
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { CmsPage } from "../src/react/CmsPage";
import { CmsRegion } from "../src/react/CmsRegion";
import { cmsHeadStyle } from "../src/react/headStyles";
import { emitDocCss } from "../src/render/css";
import { cmsStyleTag, styleTagHtml } from "../src/render/style-tag";
import type { Node, PageDoc } from "../src/document/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const text = (id: string): Node => ({ id, type: "text", parent: null, order: "a0", props: { content: "Hello" }, style: { base: { color: "#111111" } } });
const kpi: Node = { id: "k", type: "kpi", parent: null, order: "a1", props: { label: "Revenue", value: 5 }, style: { base: {} } };
const page = (id: string, nodes: Node[] = [text("t"), kpi]): PageDoc => ({
  id,
  seq: 0,
  meta: { title: "P", slug: "/", scrollMode: "smooth" },
  theme: { name: "default" },
  breakpoints: ["base"],
  nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
});

/** Every <style> that opens inside an open <div>, by a tag scan of the markup. */
function stylesInsideDivs(html: string): number {
  let depth = 0;
  let found = 0;
  for (const m of html.matchAll(/<(\/?)(div|style)\b[^>]*>/g)) {
    if (m[2] === "div") depth += m[1] ? -1 : 1;
    else if (!m[1] && depth > 0) found++;
  }
  return found;
}

const roots: Root[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) act(() => r.unmount());
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

function mount(el: React.ReactElement): HTMLElement {
  const host = document.createElement("div");
  host.id = "app";
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  act(() => root.render(el));
  return host;
}

const headStyles = () => Array.from(document.head.querySelectorAll("style[data-cms-styles]"));

describe("server rendering", () => {
  it("puts no <style> inside the host's <div>", () => {
    for (const el of [<CmsPage doc={page("home")} />, <CmsRegion doc={page("home")} root="t" />]) {
      const html = renderToString(<div id="app">{el}</div>);
      expect(html).toContain('data-cms="t"');
      expect(stylesInsideDivs(html)).toBe(0);
      expect(html).not.toContain("<style");
    }
  });

  it("hands the host the same CSS for its head, as HTML or as a head element", () => {
    const doc = page("home");
    expect(cmsStyleTag(doc)).toBe(styleTagHtml("home", emitDocCss(doc)));
    expect(renderToString(cmsHeadStyle(doc))).toBe(cmsStyleTag(doc));
    expect(cmsStyleTag(page("empty", []))).toBe("");
  });

  it("an id cannot close the head element", () => {
    const tag = cmsStyleTag(page('x"></style><script>alert(1)</script>', [text('y"]</style><script>alert(2)</script>')]));
    expect(tag).not.toContain("<script>");
    expect(tag.match(/<\/style>/g)).toHaveLength(1);
  });
});

describe("in the browser", () => {
  it("keeps the stylesheet in document.head, not in the page, and removes it on unmount", () => {
    const doc = page("home");
    const host = mount(<CmsPage doc={doc} />);
    expect(host.querySelector("style")).toBeNull();
    expect(headStyles()).toHaveLength(1);
    expect(headStyles()[0]!.getAttribute("data-cms-styles")).toBe("home");
    expect(headStyles()[0]!.textContent).toBe(emitDocCss(doc));
    act(() => roots.pop()!.unmount());
    expect(headStyles()).toHaveLength(0);
  });

  it("uses an identical element the server put in the head, and leaves it there", () => {
    const doc = page("home");
    document.head.innerHTML = cmsStyleTag(doc);
    const placed = headStyles()[0];
    const host = document.createElement("div");
    host.innerHTML = renderToString(<CmsPage doc={doc} />);
    document.body.appendChild(host);
    let root!: Root;
    act(() => {
      root = hydrateRoot(host, <CmsPage doc={doc} />);
    });
    act(() => {});
    expect(headStyles()).toEqual([placed]);
    act(() => root.unmount());
    expect(headStyles()).toEqual([placed]);
  });

  it("shares one element between pages of the same document, and one each for different documents", () => {
    mount(<CmsPage doc={page("home")} />);
    mount(<CmsPage doc={page("home")} />);
    mount(<CmsRegion doc={page("footer")} root="t" />);
    expect(headStyles().map((s) => s.getAttribute("data-cms-styles"))).toEqual(["home", "footer"]);
    act(() => roots.shift()!.unmount());
    expect(headStyles()).toHaveLength(2);
  });

  it("injects nothing when the host supplies the CSS", () => {
    mount(<CmsPage doc={page("home")} includeStyles={false} />);
    expect(document.querySelectorAll("style")).toHaveLength(0);
  });

  it("follows the document: a new document's CSS replaces the old one's", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    roots.push(root);
    act(() => root.render(<CmsPage doc={page("a")} />));
    act(() => root.render(<CmsPage doc={page("b", [text("u")])} />));
    expect(headStyles().map((s) => s.getAttribute("data-cms-styles"))).toEqual(["b"]);
  });
});
