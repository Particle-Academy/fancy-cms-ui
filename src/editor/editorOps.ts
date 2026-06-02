/**
 * Higher-level editor commands expressed as pure {@link PageOp} sequences over
 * the spine — duplicate, reorder, wrap, clipboard paste. Each returns ops the
 * caller threads through `ed.apply`, so every command stays undoable and total.
 */
import type { Node, NodeId, PageDoc } from "../document/types";
import type { PageOp } from "../document/ops";
import { childrenOf } from "../document/reduce";
import { keyBetween } from "../document/fractional";

export type NodeMap = Record<NodeId, Node>;

/** Children of `parent` within an arbitrary node map (snapshot-friendly), ordered. */
function childrenOfMap(nodes: NodeMap, parent: NodeId | null): Node[] {
  return Object.values(nodes)
    .filter((n) => n.parent === parent)
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
}

/** Parent-first BFS over a node map starting at `root`. */
function subtreeBfs(nodes: NodeMap, root: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const queue: NodeId[] = [root];
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur);
    for (const child of childrenOfMap(nodes, cur)) queue.push(child.id);
  }
  return out;
}

/**
 * Clone a subtree from `nodes` under `newParent`/`newOrder`, remapping every id.
 * Returns parent-first insert ops + the new root id. Used by both Duplicate
 * (source = the live doc) and Paste (source = a detached clipboard snapshot).
 */
export function cloneFrom(
  nodes: NodeMap,
  rootId: NodeId,
  newParent: NodeId | null,
  newOrder: string,
  seqBase: number,
): { ops: PageOp[]; newRootId: NodeId | null } {
  if (!nodes[rootId]) return { ops: [], newRootId: null };
  const order = subtreeBfs(nodes, rootId);
  const idMap: Record<NodeId, NodeId> = {};
  order.forEach((old, i) => (idMap[old] = `${old}_c${seqBase}_${i}`));
  const ops: PageOp[] = order.map((old) => {
    const src = nodes[old]!;
    const cloned: Node = JSON.parse(JSON.stringify(src));
    cloned.id = idMap[old]!;
    cloned.parent = old === rootId ? newParent : idMap[src.parent as NodeId]!;
    if (old === rootId) cloned.order = newOrder;
    return { t: "insert_node", node: cloned };
  });
  return { ops, newRootId: idMap[rootId]! };
}

/** Duplicate a node (and its subtree) immediately after itself among its siblings. */
export function duplicateOps(doc: PageDoc, id: NodeId): { ops: PageOp[]; newRootId: NodeId | null } {
  const node = doc.nodes[id];
  if (!node) return { ops: [], newRootId: null };
  const sibs = childrenOf(doc, node.parent);
  const idx = sibs.findIndex((s) => s.id === id);
  const newOrder = keyBetween(node.order, sibs[idx + 1]?.order ?? null);
  const { ops, newRootId } = cloneFrom(doc.nodes, id, node.parent, newOrder, doc.seq);
  if (node.parent === null && newRootId) {
    const base = doc.sections;
    const at = base.indexOf(id);
    ops.push({ t: "reorder_sections", order: [...base.slice(0, at + 1), newRootId, ...base.slice(at + 1)] });
  }
  return { ops, newRootId };
}

/** Paste a clipboard snapshot as a child of `target` (if a container) or its sibling. */
export function pasteOps(
  doc: PageDoc,
  clip: { rootId: NodeId; nodes: NodeMap },
  target: NodeId | null,
  containerTypes: Set<string>,
): { ops: PageOp[]; newRootId: NodeId | null } {
  const sel = target ? doc.nodes[target] : null;
  const parent = sel ? (containerTypes.has(sel.type) ? sel.id : sel.parent) : (doc.sections[doc.sections.length - 1] ?? null);
  const sibs = childrenOf(doc, parent);
  const newOrder = keyBetween(sibs.length ? sibs[sibs.length - 1]!.order : null, null);
  const { ops, newRootId } = cloneFrom(clip.nodes, clip.rootId, parent, newOrder, doc.seq);
  if (parent === null && newRootId) {
    // a top-level paste lands at the end of the section order, which is fine.
  }
  return { ops, newRootId };
}

export type ReorderDir = "up" | "down" | "front" | "back";

/** Reorder a node among its siblings (or sections, for a top-level node). */
export function reorderOps(doc: PageDoc, id: NodeId, dir: ReorderDir): PageOp[] {
  const node = doc.nodes[id];
  if (!node) return [];

  if (node.parent === null) {
    const s = [...doc.sections];
    const i = s.indexOf(id);
    if (i < 0) return [];
    s.splice(i, 1);
    if (dir === "front") s.unshift(id);
    else if (dir === "back") s.push(id);
    else s.splice(Math.max(0, Math.min(s.length, dir === "up" ? i - 1 : i + 1)), 0, id);
    return [{ t: "reorder_sections", order: s }];
  }

  const sibs = childrenOf(doc, node.parent);
  const idx = sibs.findIndex((sb) => sb.id === id);
  if (idx < 0) return [];
  const last = sibs.length - 1;
  let newOrder: string;
  if (dir === "up") {
    if (idx <= 0) return [];
    newOrder = keyBetween(sibs[idx - 2]?.order ?? null, sibs[idx - 1]!.order);
  } else if (dir === "down") {
    if (idx >= last) return [];
    newOrder = keyBetween(sibs[idx + 1]!.order, sibs[idx + 2]?.order ?? null);
  } else if (dir === "front") {
    if (idx >= last) return [];
    newOrder = keyBetween(sibs[last]!.order, null);
  } else {
    if (idx <= 0) return [];
    newOrder = keyBetween(null, sibs[0]!.order);
  }
  return [{ t: "move_node", id, parent: node.parent, order: newOrder }];
}

/** Wrap a (non-top-level) node in a new padded Box (frame) that takes its slot. */
export function wrapInBoxOps(doc: PageDoc, id: NodeId): { ops: PageOp[]; newRootId: NodeId | null } {
  const node = doc.nodes[id];
  if (!node || node.parent === null) return { ops: [], newRootId: null };
  const frameId = `box_${doc.seq}`;
  return {
    ops: [
      { t: "insert_node", node: { id: frameId, type: "frame", parent: node.parent, order: node.order, props: {}, style: { base: { padding: { value: 16, unit: "px" } } } } },
      { t: "move_node", id, parent: frameId, order: "a" },
    ],
    newRootId: frameId,
  };
}

/** Snapshot a node's subtree into a detached clipboard payload. */
export function snapshotSubtree(doc: PageDoc, id: NodeId): { rootId: NodeId; nodes: NodeMap } | null {
  if (!doc.nodes[id]) return null;
  const ids = subtreeBfs(doc.nodes, id);
  const nodes: NodeMap = {};
  for (const nid of ids) nodes[nid] = JSON.parse(JSON.stringify(doc.nodes[nid]));
  return { rootId: id, nodes };
}
