import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The two op vocabularies must stay disjoint.
 *
 * `fancy-doc-commons`' TreeOp and this package's PageOp both discriminate on
 * `t`. When a tag appears in both, a stored op is valid under two vocabularies
 * and reduced by two different reducers — and nothing in the document says
 * which one it meant. Not theoretical: until 0.6.0 the props-patch variant was
 * in both, with a byte-identical shape.
 *
 * The alternative the polyglot plan weighed was a versioned envelope on every
 * op across all 41 packages. Keeping the tag spaces disjoint is the cheap
 * version of the same guarantee — but only while something checks, which is
 * this file.
 *
 * Tags are read from SOURCE, because these are type-level unions that erase at
 * runtime; the tags exist only in the text.
 */
function tagsIn(path: string, name: "PageOp" | "TreeOp"): string[] {
  const src = readFileSync(new URL(path, import.meta.url), "utf8");

  // Strip comments FIRST. The prose in ops.ts explaining this very collision
  // quotes the old tag, and without this the extractor reports a tag that no
  // longer exists in the union — the check failing on its own documentation.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  const start = code.indexOf(`type ${name}`);
  if (start === -1) return [];

  // The union runs to the first line that begins a new top-level declaration.
  const rest = code.slice(start);
  const end = rest.search(/\n(?:export |declare |type |interface |function |const )/);
  const union = end === -1 ? rest : rest.slice(0, end);

  return [...union.matchAll(/\bt:\s*"([a-z_]+)"/g)].map((m) => m[1]!);
}

describe("op vocabularies stay disjoint", () => {
  const pageTags = tagsIn("../src/document/ops.ts", "PageOp");
  const treeTags = tagsIn("../node_modules/@particle-academy/fancy-doc-commons/dist/index.d.ts", "TreeOp");

  it("found both vocabularies", () => {
    // Without this, an extractor that silently stopped matching would make the
    // collision check below pass on two empty lists.
    expect(pageTags.length, "PageOp tags not found").toBeGreaterThan(8);
    expect(treeTags.length, "TreeOp tags not found").toBeGreaterThan(2);
  });

  it("shares no tag with TreeOp", () => {
    const shared = pageTags.filter((t) => treeTags.includes(t));

    expect(shared, `valid under BOTH vocabularies: ${shared.join(", ")}`).toEqual([]);
  });

  it("uses the renamed variant, not the colliding one", () => {
    expect(pageTags).toContain("set_node_props");
    expect(pageTags).not.toContain("set_props");
  });

  it("still covers TreeOp's own tags", () => {
    // Guards the TreeOp side of the extraction specifically: if doc-commons
    // reformats its .d.ts, this fails rather than quietly reporting nothing to
    // compare against.
    expect(treeTags).toEqual(expect.arrayContaining(["insert", "remove", "move"]));
  });
});
