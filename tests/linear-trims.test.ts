/**
 * Trims on consumer-reachable strings are linear, and trim exactly what their
 * PHP twins trim.
 *
 * - `trimCssWhitespace` (font unicode-range parts) replaced an unanchored
 *   `[ \t\r\n\f]+$` regex, quadratic in the length of a whitespace run. PHP:
 *   `trim($part, " \t\r\n\f")` in FontAssets.
 * - `safeHref` trims an author's href with the native `String.prototype.trim`,
 *   which is linear. Its PHP twin `JsValue::trim` was a regex with the same
 *   quadratic tail and is now a loop over the code points listed below.
 */
import { describe, expect, it } from "vitest";
import { trimCssWhitespace } from "../src/render/fonts";
import { safeHref } from "../src/react/registry";

const N = 1_000_000;

describe("trimCssWhitespace", () => {
  it("trims a long run's ends quickly and keeps the run inside", () => {
    const inner = "U+0000" + " ".repeat(N) + "x";
    const start = performance.now();
    expect(trimCssWhitespace(" \t\r\n\f" + inner + "\f\n\r\t ")).toBe(inner);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("trims a run of nothing but whitespace to empty quickly", () => {
    const start = performance.now();
    expect(trimCssWhitespace(" ".repeat(N))).toBe("");
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("trims exactly space, tab, CR, LF and FF, as the regex did", () => {
    const re = /^[ \t\r\n\f]+|[ \t\r\n\f]+$/g;
    for (let cp = 0; cp < 0x80; cp++) {
      const c = String.fromCharCode(cp);
      const s = c + c + "U+41" + c + c;
      expect(trimCssWhitespace(s), `U+${cp.toString(16)}`).toBe(s.replace(re, ""));
    }
    for (const s of ["", " ", "a", " a ", "a b", "\v a \v"]) expect(trimCssWhitespace(s), JSON.stringify(s)).toBe(s.replace(re, ""));
  });
});

describe("safeHref's trim, the twin of JsValue::trim", () => {
  // The PHP list in JsValue::trim and tests/JsValueTrimTest.php.
  const TRIMMED = [
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
    0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
  ];

  it("trims exactly the code points the PHP renderer trims", () => {
    const trimmed: number[] = [];
    for (let cp = 0; cp <= 0xffff; cp++) {
      const c = String.fromCharCode(cp);
      if ((c + "a" + c).trim() === "a") trimmed.push(cp);
    }
    expect(trimmed).toEqual(TRIMMED);
  });

  it("keeps a long whitespace run inside an href, quickly", () => {
    const href = "/a" + " ".repeat(N) + "b";
    const start = performance.now();
    expect(safeHref(" 　" + href + "  ")).toBe(href);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
