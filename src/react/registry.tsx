import type { ReactNode } from "react";
import { isBinding, type Bound, type Json, type Node, type PageDoc } from "../document/types";

export interface ElementContext {
  node: Node;
  doc: PageDoc;
  /** Pre-rendered child nodes, in order. */
  children: ReactNode;
}

/**
 * Renders the INNER content of a node. The outer `[data-cms]` wrapper is added
 * by {@link RenderNode}, so a renderer only returns what goes inside.
 */
export type ElementRenderer = (ctx: ElementContext) => ReactNode;

export type ElementRegistry = Record<string, ElementRenderer>;

/** Resolve a literal prop to a string (bindings resolve in Phase 3). */
function literal(v: Bound<Json> | undefined): string {
  if (v === undefined || v === null) return "";
  if (isBinding(v)) return "";
  return String(v);
}

/** Built-in native elements. Containers render their children; leaves render content. */
export const defaultRegistry: ElementRegistry = {
  section: ({ children }) => children,
  stack: ({ children }) => children,
  grid: ({ children }) => children,
  frame: ({ children }) => children,
  shape: ({ children }) => children,
  text: ({ node }) => literal(node.props.content),
  image: ({ node }) => (
    <img
      src={literal(node.props.src)}
      alt={literal(node.props.alt)}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  ),
};
