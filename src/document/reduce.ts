/**
 * The pure, total reducer. `reduce(doc, op)` returns a new document; an invalid
 * op is a **logged no-op** (returns the same doc, `seq` unchanged). That single
 * property is what makes undo, revisions, collaboration, and agent edits all
 * flow through one spine.
 *
 * Ordering: EVERY level uses the fractional `order` field among siblings,
 * including the roots. Top-level order used to live in a separate `sections`
 * array, which meant two mechanisms that could disagree — a node could be a
 * root by `parent === null` and missing from `sections`, and then simply not
 * render, with nothing reporting it.
 */
import {
  childrenOf as docChildrenOf,
  descendantsOf,
  fractionalKey,
} from "@particle-academy/fancy-doc-commons";
import type { Action, Node, NodeId, PageDoc, StyleProps } from "./types";
import type { PageOp } from "./ops";

export interface ReduceOptions {
  /** Called when an op can't apply. Default: silent. */
  onInvalid?: (op: PageOp, reason: string) => void;
}

/**
 * Children of a node (or the roots when `parent` is null), in order.
 *
 * Delegates to doc-commons so the CMS, fancy-screens and any future surface
 * walk a document the same way. Roots are no longer a special case.
 */
export function childrenOf(doc: PageDoc, parent: NodeId | null): Node[] {
  return docChildrenOf<Node>(doc, parent);
}

/**
 * The top-level node ids, in order.
 *
 * Replaces the old `doc.sections` array. Kept as a named helper because the two
 * things callers actually wanted from that array — "list the roots" and "the
 * last root" — read badly as `childrenOf(doc, null).map(n => n.id)` at every
 * call site.
 */
export function rootIds(doc: PageDoc): NodeId[] {
  return childrenOf(doc, null).map((n) => n.id);
}

/** The last top-level node, or null — the default parent for a new insert. */
export function lastRootId(doc: PageDoc): NodeId | null {
  const r = rootIds(doc);
  return r[r.length - 1] ?? null;
}

/** Every transitive descendant id of `id` (excludes `id`). */
export function descendantIds(doc: PageDoc, id: NodeId): NodeId[] {
  return descendantsOf<Node>(doc, id);
}

function patchNode(doc: PageDoc, id: NodeId, patch: Partial<Node>): PageDoc {
  const node = doc.nodes[id]!;
  return {
    ...doc,
    nodes: { ...doc.nodes, [id]: { ...node, ...patch } },
    seq: doc.seq + 1,
  };
}

export function reduce(doc: PageDoc, op: PageOp, opts: ReduceOptions = {}): PageDoc {
  const invalid = (reason: string): PageDoc => {
    opts.onInvalid?.(op, reason);
    return doc;
  };

  switch (op.t) {
    case "insert_node": {
      if (doc.nodes[op.node.id]) return invalid("node id already exists");
      if (op.node.parent !== null && !doc.nodes[op.node.parent]) return invalid("parent not found");
      return {
        ...doc,
        nodes: { ...doc.nodes, [op.node.id]: op.node },
        seq: doc.seq + 1,
      };
    }

    case "remove_node": {
      if (!doc.nodes[op.id]) return invalid("node not found");
      const dead = new Set<NodeId>([op.id, ...descendantIds(doc, op.id)]);
      const nodes: Record<NodeId, Node> = {};
      for (const id of Object.keys(doc.nodes)) {
        if (!dead.has(id)) nodes[id] = doc.nodes[id]!;
      }
      return {
        ...doc,
        nodes,
        seq: doc.seq + 1,
      };
    }

    case "move_node": {
      const node = doc.nodes[op.id];
      if (!node) return invalid("node not found");
      if (op.parent === op.id) return invalid("cannot parent a node to itself");
      if (op.parent !== null && !doc.nodes[op.parent]) return invalid("new parent not found");
      if (op.parent !== null && descendantIds(doc, op.id).includes(op.parent)) {
        return invalid("move would create a cycle");
      }
      return {
        ...doc,
        nodes: { ...doc.nodes, [op.id]: { ...node, parent: op.parent, order: op.order } },
        seq: doc.seq + 1,
      };
    }

    case "set_props": {
      if (!doc.nodes[op.id]) return invalid("node not found");
      return patchNode(doc, op.id, {
        props: { ...doc.nodes[op.id]!.props, ...op.patch } as unknown as Node["props"],
      });
    }

    case "set_layout": {
      if (!doc.nodes[op.id]) return invalid("node not found");
      return patchNode(doc, op.id, { layout: op.layout });
    }

    case "set_style": {
      const node = doc.nodes[op.id];
      if (!node) return invalid("node not found");
      const prev = node.style[op.breakpoint] ?? {};
      return patchNode(doc, op.id, {
        style: { ...node.style, [op.breakpoint]: { ...prev, ...op.patch } } as Node["style"],
      });
    }

    case "set_constraints": {
      const node = doc.nodes[op.id];
      if (!node) return invalid("node not found");
      const base = node.constraints ?? { base: { width: "hug", height: "hug" } };
      const prev = base[op.breakpoint] ?? {};
      return patchNode(doc, op.id, {
        constraints: { ...base, [op.breakpoint]: { ...prev, ...op.patch } } as Node["constraints"],
      });
    }

    case "set_animation": {
      const node = doc.nodes[op.id];
      if (!node) return invalid("node not found");
      const list = node.animations ?? [];
      const idx = list.findIndex((a) => a.id === op.anim.id);
      return patchNode(doc, op.id, {
        animations: idx >= 0 ? list.map((a, i) => (i === idx ? op.anim : a)) : [...list, op.anim],
      });
    }

    case "remove_animation": {
      const node = doc.nodes[op.id];
      if (!node) return invalid("node not found");
      return patchNode(doc, op.id, {
        animations: (node.animations ?? []).filter((a) => a.id !== op.animId),
      });
    }

    case "set_action": {
      const node = doc.nodes[op.id];
      if (!node) return invalid("node not found");
      const list = node.actions ?? [];
      let actions: Action[];
      if (op.action === null) actions = list.filter((_, i) => i !== op.index);
      else if (op.index >= list.length) actions = [...list, op.action];
      else actions = list.map((a, i) => (i === op.index ? op.action! : a));
      return patchNode(doc, op.id, { actions });
    }

    case "set_meta":
      return { ...doc, meta: { ...doc.meta, ...op.patch }, seq: doc.seq + 1 };

    case "set_theme":
      return { ...doc, theme: { ...doc.theme, ...op.patch }, seq: doc.seq + 1 };

    case "reorder_roots": {
      // Roots are ordered by their own fractional keys now, so a reorder
      // REWRITES those keys rather than replacing a list. Still validated as a
      // permutation: a partial list would silently drop roots out of the page.
      const currentRoots = childrenOf(doc, null);
      const current = new Set(currentRoots.map((n) => n.id));
      const same =
        op.order.length === currentRoots.length && op.order.every((id) => current.has(id));
      if (!same) return invalid("reorder must be a permutation of the current roots");

      const nodes = { ...doc.nodes };
      let prev: string | null = null;
      for (const id of op.order) {
        prev = fractionalKey(prev, null);
        nodes[id] = { ...nodes[id]!, order: prev };
      }
      return { ...doc, nodes, seq: doc.seq + 1 };
    }

    default:
      return invalid(`unknown op "${(op as PageOp).t}"`);
  }
}

/** Apply a sequence of ops, threading the document. */
export function reduceAll(doc: PageDoc, ops: PageOp[], opts?: ReduceOptions): PageDoc {
  return ops.reduce((d, op) => reduce(d, op, opts), doc);
}

/**
 * Inverse op(s) for undo, computed against the **pre-op** document. Structural
 * ops invert cleanly; merge-style ops (`set_props`/`set_style`/`set_constraints`)
 * restore the previous values of the touched keys (keys that did not previously
 * exist can't be deleted via a merge — a known Phase-0 limitation).
 */
export function invert(doc: PageDoc, op: PageOp): PageOp[] {
  switch (op.t) {
    case "insert_node":
      return [{ t: "remove_node", id: op.node.id }];

    case "remove_node": {
      const node = doc.nodes[op.id];
      if (!node) return [];
      // Re-insert the subtree parent-first, then restore section order.
      const ids = [op.id, ...descendantIds(doc, op.id)];
      const inserts: PageOp[] = ids.map((id) => ({ t: "insert_node", node: doc.nodes[id]! }));
      if (node.parent === null) {
        inserts.push({ t: "reorder_roots", order: childrenOf(doc, null).map((n) => n.id) });
      }
      return inserts;
    }

    case "move_node": {
      const node = doc.nodes[op.id];
      if (!node) return [];
      const back: PageOp[] = [{ t: "move_node", id: op.id, parent: node.parent, order: node.order }];
      if (node.parent === null) {
        back.push({ t: "reorder_roots", order: childrenOf(doc, null).map((n) => n.id) });
      }
      return back;
    }

    case "set_props": {
      const node = doc.nodes[op.id];
      if (!node) return [];
      const prev: Record<string, unknown> = {};
      for (const k of Object.keys(op.patch)) prev[k] = node.props[k];
      return [{ t: "set_props", id: op.id, patch: prev }];
    }

    case "set_layout": {
      const node = doc.nodes[op.id];
      if (!node) return [];
      return [{ t: "set_layout", id: op.id, layout: node.layout }];
    }

    case "set_style": {
      const node = doc.nodes[op.id];
      if (!node) return [];
      const prevBp = (node.style[op.breakpoint] ?? {}) as Record<string, unknown>;
      const prev: Partial<StyleProps> = {};
      for (const k of Object.keys(op.patch)) (prev as Record<string, unknown>)[k] = prevBp[k];
      return [{ t: "set_style", id: op.id, breakpoint: op.breakpoint, patch: prev }];
    }

    case "set_meta":
      return [{ t: "set_meta", patch: pick(doc.meta, Object.keys(op.patch)) }];

    case "set_theme":
      return [{ t: "set_theme", patch: pick(doc.theme, Object.keys(op.patch)) }];

    case "reorder_roots":
      return [{ t: "reorder_roots", order: childrenOf(doc, null).map((n) => n.id) }];

    default:
      return [];
  }
}

function pick<T extends object>(obj: T, keys: string[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) (out as Record<string, unknown>)[k] = (obj as Record<string, unknown>)[k];
  return out;
}
