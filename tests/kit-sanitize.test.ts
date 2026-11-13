/** What a kit component may receive: declared props only, data only, safe URLs, no markup. */
import { describe, expect, it } from "vitest";
import { sanitizeProps } from "../src/kit/sanitize";

const schema = { type: "object", properties: { title: {}, items: {}, deck: {}, src: {}, image: {} } };

describe("sanitizeProps", () => {
  it("drops props the schema does not declare", () => {
    expect(sanitizeProps({ title: "T", onClick: "x", className: "evil" }, schema)).toEqual({ title: "T" });
  });

  it("drops functions and class instances at any depth", () => {
    const out = sanitizeProps({ items: [{ a: 1, f: () => 1, d: new Date(0) }] }, schema);
    expect(out).toEqual({ items: [{ a: 1 }] });
  });

  it("drops a URL with an unsafe scheme, at any depth, and keeps safe ones", () => {
    const out = sanitizeProps({ src: "javascript:alert(1)", items: [{ href: " JaVaScRiPt:alert(1)" }, { href: "/ok" }, { image: "https://example.com/a.png" }] }, schema);
    expect(out).toEqual({ items: [{}, { href: "/ok" }, { image: "https://example.com/a.png" }] });
  });

  it("keeps an inline raster image but never inline SVG", () => {
    expect(sanitizeProps({ src: "data:image/png;base64,AAAA" }, schema)).toEqual({ src: "data:image/png;base64,AAAA" });
    expect(sanitizeProps({ src: "data:image/svg+xml;base64,AAAA" }, schema)).toEqual({});
  });

  it("drops raw HTML fields and the html format switch at any depth", () => {
    const deck = { slides: [{ elements: [{ type: "text", content: "<img src=x onerror=alert(1)>", format: "html" }, { kind: "html", html: "<b>x</b>" }] }] };
    expect(sanitizeProps({ deck }, schema)).toEqual({ deck: { slides: [{ elements: [{ type: "text", content: "<img src=x onerror=alert(1)>" }, { kind: "html" }] }] } });
  });

  it("never copies a prototype key", () => {
    const hostile = JSON.parse('{"items":[{"__proto__":{"polluted":true},"constructor":{"x":1},"a":1}]}');
    const out = sanitizeProps(hostile, schema) as { items: Record<string, unknown>[] };
    expect(out.items[0]).toEqual({ a: 1 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
