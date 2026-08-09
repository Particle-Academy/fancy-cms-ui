import { describe, expect, it } from "vitest";
import {
  CANONICAL_IDS,
  CANONICAL_TREE,
  CANONICAL_WALKS,
  ancestorsOf,
  childrenOf,
  descendantsOf,
  roots,
} from "@particle-academy/fancy-doc-commons";

import { emptyDoc, type Node, type PageDoc } from "../src/document/types";

/**
 * The CMS shares the substrate — story #171, AC1.
 *
 * The AC asks that the CMS and `fancy-screens` read and write the SAME
 * node/tree/op types, *"asserted by a shared fixture rather than by
 * inspection"*. Both declare `extends DocNode`, and the type system checks that
 * claim **inside each package**. What it cannot check is that the two agree at
 * runtime on the thing that matters: the same tree, walked by the same
 * functions, giving the same answer whichever surface owns it.
 *
 * So this asserts `CANONICAL_WALKS` — the constants shipped by
 * `fancy-doc-commons` and asserted identically in `fancy-screens`. If the CMS
 * ever forks the substrate, this fails here rather than surfacing when a bridge
 * hands a CMS page to a screen and gets a different shape back.
 */

/** The fixture, widened to a CMS `Node`. No cast that would defeat the point. */
function asPageDoc(): PageDoc {
  const doc = emptyDoc("conformance");

  for (const [id, node] of Object.entries(CANONICAL_TREE.nodes)) {
    // The CMS adds domain fields on top of the substrate; the substrate fields
    // are carried through untouched, which is the whole claim under test.
    doc.nodes[id] = { ...node, style: {}, props: {} } as Node;
  }

  return doc;
}

describe("CMS documents are DocTrees", () => {
  const doc = asPageDoc();

  it("agrees on roots and their order", () => {
    expect(roots(doc).map((n) => n.id)).toEqual([...CANONICAL_WALKS.roots]);
  });

  it("agrees on sibling order", () => {
    expect(childrenOf(doc, CANONICAL_IDS.rootB).map((n) => n.id)).toEqual([
      ...CANONICAL_WALKS.childrenOfRootB,
    ]);
  });

  it("agrees on descendants", () => {
    expect(descendantsOf(doc, CANONICAL_IDS.rootB)).toEqual([
      ...CANONICAL_WALKS.descendantsOfRootB,
    ]);
  });

  it("agrees on ancestors", () => {
    expect(ancestorsOf(doc, CANONICAL_IDS.grandchild)).toEqual([
      ...CANONICAL_WALKS.ancestorsOfGrandchild,
    ]);
  });

  it("agrees that an orphan has no ancestors and is not a root", () => {
    // A CMS page loaded from a database can genuinely contain one. Every surface
    // has to treat it the same way, or the same document renders differently
    // depending on which one opened it.
    expect(ancestorsOf(doc, CANONICAL_IDS.orphan)).toEqual([
      ...CANONICAL_WALKS.ancestorsOfOrphan,
    ]);
    expect(roots(doc).some((n) => n.id === CANONICAL_IDS.orphan)).toBe(false);
  });

  it("carries the substrate fields through a JSON round trip", () => {
    // CMS pages are persisted. A shared type that does not survive
    // serialisation is not shared where it counts.
    const round = JSON.parse(JSON.stringify(doc)) as PageDoc;

    expect(roots(round).map((n) => n.id)).toEqual([...CANONICAL_WALKS.roots]);
  });
});
