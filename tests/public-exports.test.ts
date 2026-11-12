/**
 * The raw-CSS `<style>` builder is module-internal (CodeQL
 * `js/html-constructed-from-input`, alert 3). A host gets the head stylesheet
 * only through document-shaped functions: `cmsStyleTag(doc)`, `cmsStyleText(doc)`
 * and `cmsHeadStyle(doc)` (./react). No entry point the package publishes may
 * offer `styleTagHtml(key, css)` or the bare `styleText(css)`.
 */
import { describe, expect, it } from "vitest";
import * as root from "../src/index";
import * as react from "../src/react/index";
import * as editor from "../src/editor/index";

const entries: Record<string, Record<string, unknown>> = { ".": root, "./react": react, "./editor": editor };

describe("the package's public surface", () => {
  for (const [name, mod] of Object.entries(entries)) {
    it(`${name} does not export the raw-CSS style builder`, () => {
      expect(mod).not.toHaveProperty("styleTagHtml");
      expect(mod).not.toHaveProperty("styleText");
    });
  }

  it("exports the document-shaped head functions", () => {
    expect(typeof root.cmsStyleTag).toBe("function");
    expect(typeof root.cmsStyleText).toBe("function");
    expect(typeof root.styleKey).toBe("function");
    expect(typeof react.cmsHeadStyle).toBe("function");
  });
});
