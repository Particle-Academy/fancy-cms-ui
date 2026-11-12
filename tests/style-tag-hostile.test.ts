// @vitest-environment jsdom
/**
 * `styleTagHtml` is module-internal now (tests/public-exports.test.ts), but it is
 * still the one place the `<style>` element is written, and PHP's
 * `PageRenderer::styleTag` is held to its bytes. Whatever the css says, the
 * element it returns must be one `<style>` that an HTML parser closes where we
 * close it. The raw-css cases are in the shared fixture.
 *
 * The public functions take a DOCUMENT, not css, so they are attacked with
 * hostile documents: every one of the fixture's hostile strings, as a page id,
 * a node id and a free-form style value.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { cmsHeadStyle } from "../src/react/headStyles";
import { emitDocCss } from "../src/render/css";
import { cmsStyleTag, cmsStyleText, styleTagHtml, styleText } from "../src/render/style-tag";
import type { Node, PageDoc } from "../src/document/types";

interface Tag {
  key: string;
  css: string;
  html: string;
}
const fixture = JSON.parse(readFileSync(resolve(__dirname, "fixtures/inputs.json"), "utf8")) as { styleTagHostile: Tag[] };

/** Parse the tag where a host puts it: in the head, with a sentinel after it. */
function parse(html: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><html><head>${html}<meta name="after"></head><body></body></html>`, "text/html");
}

describe("styleTagHtml against hostile css", () => {
  it("covers the cases the brief names", () => {
    const all = fixture.styleTagHostile.map((t) => t.css).join("\n");
    expect(all).toContain("</style><script>");
    expect(all).toContain("</STYLE");
    expect(all).toContain("<!--");
  });

  for (const tag of fixture.styleTagHostile) {
    it(`is the shared bytes for ${JSON.stringify(tag.css)}`, () => {
      expect(styleTagHtml(tag.key, tag.css)).toBe(tag.html);
    });

    it(`cannot be closed early by ${JSON.stringify(tag.css)}`, () => {
      const html = styleTagHtml(tag.key, tag.css);
      expect(html.slice(0, -"</style>".length).toLowerCase()).not.toContain("</style");
      expect(html).not.toContain("<!--");
      const d = parse(html);
      const styles = d.querySelectorAll("style");
      expect(styles.length).toBe(1);
      expect(d.querySelector("script, img")).toBeNull();
      // The whole css, and only it, is the element's text; the sentinel follows it.
      expect(styles[0]!.textContent).toBe(styleText(tag.css));
      expect(styles[0]!.nextElementSibling?.getAttribute("name")).toBe("after");
    });
  }

  it("leaves css with nothing to neutralise untouched", () => {
    const css = ":where([data-cms] > img) {\n  width: 100%;\n}\n";
    expect(styleText(css)).toBe(css);
  });

  it("writes the escape the CSS tokenizer reads as '<'", () => {
    // \3C is U+003C; the single space after a hex escape is part of the escape.
    expect(styleText("</")).toBe(String.fromCharCode(92) + "3C /");
  });

  it("writes the same bytes as before for a mix of '<' that does and does not need escaping", () => {
    const bs = String.fromCharCode(92);
    expect(styleText("a<b</c<!d<")).toBe(`a<b${bs}3C /c${bs}3C !d<`);
    expect(styleText("<<//")).toBe(`<${bs}3C //`);
  });

  it("is linear on a long run of '<'", () => {
    const css = "<".repeat(200_000) + "/";
    const start = performance.now();
    const out = styleText(css);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(out).toBe("<".repeat(199_999) + String.fromCharCode(92) + "3C /");
  });
});

function hostileDoc(evil: string): PageDoc {
  const node: Node = {
    id: `n${evil}`,
    type: "text",
    parent: null,
    order: "a0",
    props: { content: "Hello" },
    style: { base: { color: "#111111", fontFamily: evil, background: `url(${evil})` } },
  };
  return {
    id: `p${evil}`,
    seq: 0,
    meta: { title: "P", slug: "/", scrollMode: "smooth" },
    theme: { name: "default" },
    breakpoints: ["base"],
    nodes: { [node.id]: node },
  } as PageDoc;
}

/** One `<style>`, no injected element, the sentinel straight after it. */
function expectOneStyle(html: string): HTMLStyleElement {
  expect(html.slice(0, -"</style>".length).toLowerCase()).not.toContain("</style");
  expect(html).not.toContain("<!--");
  const d = parse(html);
  const styles = d.querySelectorAll("style");
  expect(styles.length).toBe(1);
  expect(d.querySelector("script, img")).toBeNull();
  expect(styles[0]!.nextElementSibling?.getAttribute("name")).toBe("after");
  return styles[0]!;
}

describe("the public head functions against hostile documents", () => {
  for (const tag of fixture.styleTagHostile) {
    const doc = hostileDoc(tag.css);

    it(`cmsStyleTag cannot be closed early by ${JSON.stringify(tag.css)}`, () => {
      const html = cmsStyleTag(doc);
      const style = expectOneStyle(html);
      expect(style.textContent).toBe(cmsStyleText(doc));
    });

    it(`cmsStyleText is safe element text for ${JSON.stringify(tag.css)}`, () => {
      const css = cmsStyleText(doc);
      expect(css).toBe(styleText(emitDocCss(doc)));
      expect(css.toLowerCase()).not.toContain("</style");
      expect(css).not.toContain("<!");
      // What a host's own head API writes: <style>{text}</style>.
      expectOneStyle(`<style>${css}</style>`);
    });

    it(`cmsHeadStyle renders the same bytes as cmsStyleTag for ${JSON.stringify(tag.css)}`, () => {
      const html = renderToStaticMarkup(cmsHeadStyle(doc));
      expect(html).toBe(cmsStyleTag(doc));
      expectOneStyle(html);
    });
  }
});
