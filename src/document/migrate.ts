/**
 * Forward migration for documents saved before roots were ordered like every
 * other sibling group.
 *
 * ## Why this cannot be skipped
 *
 * The old model carried top-level order TWICE: a `sections: NodeId[]` array, and
 * an `order` key on every node like any other sibling. The old `reorder_sections`
 * op permuted the array and **left the order keys untouched** — so the moment a
 * user dragged a section, the two disagreed, and `sections[]` was the one that
 * won (it was what the renderer walked).
 *
 * Which means: dropping `sections[]` and falling back to the order keys does not
 * merely lose a redundant field. On every page whose sections were ever
 * rearranged, it silently reverts them to the order they were first created in.
 * The page still loads, nothing throws, and the layout is wrong.
 *
 * So the migration rewrites root `order` keys to agree with `sections[]` before
 * the array is discarded. `sections[]` is treated as authoritative for exactly
 * the reason above.
 *
 * ## Idempotent, and safe on already-migrated documents
 *
 * A doc with no `sections` is returned unchanged (same reference). Running this
 * twice is a no-op, so a host can call it unconditionally on load rather than
 * tracking a schema version.
 */

import { fractionalKey } from "@particle-academy/fancy-doc-commons";
import type { NodeId, PageDoc } from "./types";

/** A `PageDoc` as persisted before this change — with the extra array. */
export type LegacyPageDoc = PageDoc & { sections?: NodeId[] };

export interface MigrateResult {
  doc: PageDoc;
  /** True when the input actually carried `sections[]` and was rewritten. */
  migrated: boolean;
  /**
   * Ids listed in `sections[]` with no matching node. Skipped rather than
   * faulted — a dangling id is a stale write, and refusing to open the document
   * over it would be a worse outcome than dropping it.
   */
  danglingIds: NodeId[];
  /**
   * Roots present in `nodes` but missing from `sections[]`. Under the old model
   * these did not render at all. They are appended after the listed sections, in
   * their existing order-key order, because making a node visible is recoverable
   * and deleting one is not.
   */
  unlistedRootIds: NodeId[];
}

/**
 * Migrate a possibly-legacy document, reporting what was found.
 *
 * Use {@link migrateDoc} unless you want the diagnostics.
 */
export function migrateDocVerbose(input: LegacyPageDoc | PageDoc): MigrateResult {
  const legacy = input as LegacyPageDoc;
  const sections = legacy.sections;

  if (!Array.isArray(sections)) {
    return { doc: input as PageDoc, migrated: false, danglingIds: [], unlistedRootIds: [] };
  }

  const danglingIds: NodeId[] = [];
  const ordered: NodeId[] = [];
  const seen = new Set<NodeId>();

  for (const id of sections) {
    if (!input.nodes[id]) {
      danglingIds.push(id);
      continue;
    }
    // A duplicate id in the array would otherwise be minted two order keys, and
    // the second would overwrite the first — take the first occurrence.
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  // Roots that the array never mentioned. Sorted by their existing key so their
  // relative order is at least stable rather than dependent on object insertion.
  const unlistedRootIds = Object.values(input.nodes)
    .filter((n) => n.parent === null && !seen.has(n.id))
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    .map((n) => n.id);

  const finalOrder = [...ordered, ...unlistedRootIds];

  const nodes = { ...input.nodes };
  let prev: string | null = null;

  for (const id of finalOrder) {
    const key = fractionalKey(prev, null);
    nodes[id] = { ...nodes[id]!, order: key };
    prev = key;
  }

  const { sections: _dropped, ...rest } = legacy;

  return {
    doc: { ...rest, nodes } as PageDoc,
    migrated: true,
    danglingIds,
    unlistedRootIds,
  };
}

/**
 * Migrate a possibly-legacy document. Safe to call on every load — an
 * already-migrated document is returned unchanged, by reference.
 */
export function migrateDoc(input: LegacyPageDoc | PageDoc): PageDoc {
  return migrateDocVerbose(input).doc;
}

/** True when the document still carries the pre-migration `sections[]` array. */
export function needsMigration(input: LegacyPageDoc | PageDoc): boolean {
  return Array.isArray((input as LegacyPageDoc).sections);
}
