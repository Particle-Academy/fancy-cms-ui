import type { Node, PageDoc } from "./types";

export function decorativePropsError(node: Node): string | null {
  const props = node.props;
  if (!props || !Object.prototype.hasOwnProperty.call(props, "decorative") || node.type === "icon") return null;
  return ["frame", "shape"].includes(node.type) && typeof props.decorative === "boolean" ? null : "invalid decorative props";
}

/** Iterative and linear; no cached verdict can survive mutation of a raw doc. */
export function decorationError(nodes: PageDoc["nodes"] | null | undefined): string | null {
  if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) return "invalid decorative document";
  const queue: string[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (!node || typeof node !== "object") continue;
    if (decorativePropsError(node)) return "invalid decorative props";
    if (["frame", "shape"].includes(node.type) && node.props?.decorative === true) queue.push(id);
  }
  if (!queue.length) return null;
  const children = new Map<string, string[]>();
  for (const [id, node] of Object.entries(nodes)) {
    if (node && typeof node.parent === "string") {
      const ids = children.get(node.parent) ?? [];
      ids.push(id);
      children.set(node.parent, ids);
    }
  }
  const seen = new Set<string>();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor]!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes[id]!;
    if (node.actions != null && (!Array.isArray(node.actions) || node.actions.length > 0)) return "decorative subtree contains meaningful content";
    if (!["frame", "shape"].includes(node.type) && !(node.type === "icon" && node.props?.decorative === true)) return "decorative subtree contains meaningful content";
    for (const child of children.get(id) ?? []) queue.push(child);
  }
  return null;
}
