import type { Json, LayoutMode, NodeId, PageDoc, StyleProps } from "../document/types";
import type { PageOp } from "../document/ops";
import { childrenOf } from "../document/reduce";
import { keyBetween } from "../document/fractional";

/**
 * Element insertion — shared by `EditablePage` (inline editing) and `Editor`
 * (the standalone WYSIWYG shell).
 *
 * This used to live entirely inside EditablePage, which meant the embeddable
 * `Editor` had no way to add an element at all: starting from `emptyDoc()` gave
 * a blank canvas with nothing to select and no control to insert anything, so
 * a host embedding `Editor` could not author a page from scratch (#3).
 * EditablePage had the menu but no `onChange` to hand the document back —
 * each surface had half of what an embedding host needs.
 */

/** Node types that accept children, so an insert lands *inside* them. */
export const CONTAINER_TYPES = new Set([
  "section",
  "frame",
  "stack",
  "grid",
  "shape",
  "card",
  "device",
  "repeater",
]);

export type AddKind =
  | "text"
  | "heading"
  | "button"
  | "link"
  | "image"
  | "box"
  | "stack"
  | "grid"
  | "card"
  | "callout"
  | "divider"
  | "code"
  | "richtext"
  | "repeater";

export const ADD_DEFAULTS: Record<
  AddKind,
  { type: string; props: Record<string, Json>; style: StyleProps; layout?: LayoutMode }
> = {
  text: { type: "text", props: { content: "New text" }, style: { color: "inherit" } },
  heading: { type: "heading", props: { content: "New heading" }, style: { fontSize: { value: 28, unit: "px" }, fontWeight: 700 } },
  button: { type: "button", props: { label: "Button", href: "#", variant: "primary" }, style: {} },
  link: { type: "link", props: { content: "link text", href: "#" }, style: { color: "#7c3aed" } },
  image: { type: "image", props: { src: "", alt: "" }, style: {} },
  box: { type: "frame", props: {}, style: { padding: { value: 16, unit: "px" } } },
  stack: { type: "stack", props: {}, style: { gap: { value: 12, unit: "px" } }, layout: "stack" },
  grid: { type: "grid", props: {}, style: { gap: { value: 12, unit: "px" } }, layout: "grid" },
  card: { type: "card", props: {}, style: { padding: { value: 16, unit: "px" }, radius: { value: 12, unit: "px" }, border: "1px solid #e2e8f0" } },
  callout: { type: "callout", props: { content: "Heads up — this is a callout.", variant: "info" }, style: {} },
  divider: { type: "divider", props: {}, style: {} },
  code: { type: "code", props: { content: "npm install @particle-academy/react-fancy", lang: "bash" }, style: {} },
  richtext: { type: "richtext", props: { html: "<p>Rich <strong>text</strong> with <em>inline</em> formatting.</p>" }, style: {} },
  repeater: { type: "repeater", props: { items: "" }, style: { gap: { value: 12, unit: "px" } }, layout: "stack" },
};

export const ADD_MENU: Array<{ kind: AddKind; label: string }> = [
  { kind: "heading", label: "Heading" },
  { kind: "text", label: "Text" },
  { kind: "button", label: "Button" },
  { kind: "link", label: "Link" },
  { kind: "image", label: "Image" },
  { kind: "card", label: "Card" },
  { kind: "callout", label: "Callout" },
  { kind: "stack", label: "Stack" },
  { kind: "grid", label: "Grid" },
  { kind: "box", label: "Box" },
  { kind: "divider", label: "Divider" },
  { kind: "code", label: "Code" },
  { kind: "richtext", label: "Rich text" },
  { kind: "repeater", label: "Repeater" },
];

/**
 * Where a new node of `kind` should land, given the current selection.
 *
 * Into the selected container; else alongside the selected node; else the last
 * section — and when the page has no sections at all, at the top level, which
 * is what makes authoring from `emptyDoc()` possible.
 */
export function resolveInsertParent(doc: PageDoc, selectedId: NodeId | null): NodeId | null {
  const selected = selectedId ? doc.nodes[selectedId] : null;
  if (selected) {
    return CONTAINER_TYPES.has(selected.type) ? selected.id : selected.parent;
  }
  return doc.sections[doc.sections.length - 1] ?? null;
}

/**
 * Build the `insert_node` op for adding `kind` to `doc`.
 *
 * Pure — returns the op plus the new id so the caller can select it. Callers
 * apply the op through their own editor state.
 */
export function buildInsertOp(
  doc: PageDoc,
  kind: AddKind,
  selectedId: NodeId | null,
  /** Explicit target, overriding selection — used by drag-and-drop. */
  targetId?: NodeId | null,
): { op: PageOp; id: NodeId } {
  const parent =
    targetId !== undefined
      ? targetId && doc.nodes[targetId]
        ? CONTAINER_TYPES.has(doc.nodes[targetId]!.type)
          ? targetId
          : doc.nodes[targetId]!.parent
        : null
      : resolveInsertParent(doc, selectedId);

  const siblings = childrenOf(doc, parent);
  const order = keyBetween(siblings.length ? siblings[siblings.length - 1]!.order : null, null);
  const id = `n${doc.seq + 1}-${Math.floor(performance.now())}`;
  const def = ADD_DEFAULTS[kind];

  return {
    id,
    op: {
      t: "insert_node",
      node: {
        id,
        type: def.type,
        parent,
        order,
        layout: def.layout,
        props: { ...def.props },
        style: { base: { ...def.style } },
      },
    } as PageOp,
  };
}
