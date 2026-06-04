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
  card: ({ children }) => children,
  text: ({ node }) => literal(node.props.content),
  heading: ({ node }) => literal(node.props.content) || "Heading",
  link: ({ node }) => (
    <a href={literal(node.props.href) || "#"} style={{ color: "inherit", textDecoration: "underline" }}>
      {literal(node.props.content) || "link"}
    </a>
  ),
  divider: () => <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: 0 }} />,
  callout: ({ node }) => {
    const tone = ({ info: "#3b82f6", success: "#10b981", warning: "#f59e0b", danger: "#ef4444" } as Record<string, string>)[literal(node.props.variant)] ?? "#3b82f6";
    return (
      <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 10, background: `${tone}14`, borderLeft: `3px solid ${tone}` }}>
        <span style={{ fontSize: 13 }}>{literal(node.props.content) || "Callout"}</span>
      </div>
    );
  },
  code: ({ node }) => (
    <pre style={{ margin: 0, padding: "12px 14px", borderRadius: 10, background: "#0b1220", color: "#e2e8f0", fontFamily: "ui-monospace, monospace", fontSize: 13, overflowX: "auto" }}>
      <code>{literal(node.props.content)}</code>
    </pre>
  ),
  button: ({ node }) => {
    const label = literal(node.props.label) || literal(node.props.content) || "Button";
    const variant = literal(node.props.variant) || "primary";
    return <span data-cms-button={variant} style={buttonStyle(variant)}>{label}</span>;
  },
  image: ({ node }) => (
    <img
      src={literal(node.props.src)}
      alt={literal(node.props.alt)}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  ),
};

/**
 * A self-contained button look so the `button` primitive renders sensibly with
 * zero host CSS. Hosts that want their own button classes override the `button`
 * renderer in their registry (e.g. the sandbox maps it to `.btn .btn-primary`).
 */
function buttonStyle(variant: string): import("react").CSSProperties {
  const base: import("react").CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 16px",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    lineHeight: 1,
    cursor: "pointer",
    userSelect: "none",
  };
  if (variant === "ghost") return { ...base, background: "transparent", color: "inherit", border: "1px solid currentColor" };
  if (variant === "outline") return { ...base, background: "transparent", color: "#7c3aed", border: "1px solid #7c3aed" };
  return { ...base, background: "#7c3aed", color: "#fff", border: "1px solid #7c3aed" };
}
