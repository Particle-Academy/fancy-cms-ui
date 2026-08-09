import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { rootIds } from "../src/document/reduce";
import { type LegacyPageDoc, migrateDoc, migrateDocVerbose, needsMigration } from "../src/document/migrate";

/**
 * The migration, run against a REAL saved document rather than a unit fixture.
 *
 * `tests/fixtures/legacy-home-seed.json` is the showcase's own CMS home page as
 * it was actually persisted before this release — 62 nodes, seven top-level
 * sections, extracted from `px-ui-sandbox`'s `home-seed.ts` at the commit before
 * the migration landed. It is a document somebody authored, not one written to
 * make a test pass, which is the point: a hand-built fixture only contains the
 * cases its author already thought of.
 */
const legacy = JSON.parse(
  readFileSync(new URL("./fixtures/legacy-home-seed.json", import.meta.url), "utf8"),
) as LegacyPageDoc;

const SECTIONS = ["hero", "sec-packages", "sec-human-plus", "sec-components", "sec-philosophy", "sec-quickstart", "sec-explore"];

describe("migrating the showcase's real home document", () => {
  it("is a document that actually needs migrating", () => {
    // Guards the whole file: if the fixture ever lost its `sections`, every
    // assertion below would still pass while testing nothing.
    expect(needsMigration(legacy)).toBe(true);
    expect(Object.keys(legacy.nodes).length).toBeGreaterThan(50);
  });

  it("preserves the page's section order", () => {
    expect(rootIds(migrateDoc(legacy))).toEqual(SECTIONS);
  });

  it("keeps every node, at its original depth", () => {
    const out = migrateDoc(legacy);

    expect(Object.keys(out.nodes).sort()).toEqual(Object.keys(legacy.nodes).sort());

    for (const [id, before] of Object.entries(legacy.nodes)) {
      expect(out.nodes[id]!.parent, `${id} changed parent`).toBe(before.parent);
      expect(out.nodes[id]!.type, `${id} changed type`).toBe(before.type);
    }
  });

  it("leaves every non-root order key untouched", () => {
    const out = migrateDoc(legacy);
    const nested = Object.values(legacy.nodes).filter((n) => n.parent !== null);

    expect(nested.length, "fixture has no nested nodes").toBeGreaterThan(40);

    for (const n of nested) {
      expect(out.nodes[n.id]!.order, `${n.id} was re-keyed but is not a root`).toBe(n.order);
    }
  });

  it("reports nothing dangling or unlisted in a healthy document", () => {
    const r = migrateDocVerbose(legacy);

    expect(r.danglingIds).toEqual([]);
    expect(r.unlistedRootIds).toEqual([]);
  });

  it("recovers the order on the same document after a section drag", () => {
    // This document's `sections` happens to AGREE with its order keys, because
    // nobody ever reordered it — so on its own it cannot prove the migration
    // does anything. Reordering `sections` and leaving the keys alone is exactly
    // what the old `reorder_sections` op did, so this is the real document in
    // the state a single user drag would have left it in.
    const dragged: LegacyPageDoc = {
      ...legacy,
      sections: ["sec-explore", "hero", ...SECTIONS.slice(1, -1)],
    };

    expect(rootIds(migrateDoc(dragged))).toEqual(["sec-explore", "hero", "sec-packages", "sec-human-plus", "sec-components", "sec-philosophy", "sec-quickstart"]);
  });

  it("survives a second pass unchanged", () => {
    const once = migrateDoc(legacy);

    expect(migrateDoc(once)).toBe(once);
  });
});
