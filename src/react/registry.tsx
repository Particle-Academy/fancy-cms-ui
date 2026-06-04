import type { ReactNode } from "react";
import { isBinding, type Bound, type Json, type Node, type PageDoc } from "../document/types";

/** The page data context bindings resolve against (e.g. server props, repeater `item`). */
export type DataContext = Record<string, unknown>;

export interface ElementContext {
  node: Node;
  doc: PageDoc;
  /** Pre-rendered child nodes, in order. */
  children: ReactNode;
  /** The data context this node renders in (page data + any repeater scope). */
  data?: DataContext;
  /** Resolve a (possibly bound) value to its raw resolved value. */
  resolve: (v: Bound<Json> | undefined) => unknown;
  /** Resolve a (possibly bound) value to a display string. */
  text: (v: Bound<Json> | undefined) => string;
}

/**
 * Renders the INNER content of a node. The outer `[data-cms]` wrapper is added
 * by {@link RenderNode}, so a renderer only returns what goes inside.
 */
export type ElementRenderer = (ctx: ElementContext) => ReactNode;

export type ElementRegistry = Record<string, ElementRenderer>;

/** Read a dotted path (`a.b.c`) out of the data context. */
export function getPath(data: DataContext | undefined, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), data);
}

/** Resolve a value: a `{ $bind }` reads from the data context; anything else is literal. */
export function resolveValue(v: Bound<Json> | undefined, data?: DataContext): unknown {
  if (v === undefined || v === null) return v;
  if (isBinding(v)) return getPath(data, v.$bind);
  return v;
}

/** Built-in native elements. Containers render their children; leaves render content. */
export const defaultRegistry: ElementRegistry = {
  section: ({ children }) => children,
  stack: ({ children }) => children,
  grid: ({ children }) => children,
  frame: ({ children }) => children,
  shape: ({ children }) => children,
  card: ({ children }) => children,
  text: ({ node, text }) => text(node.props.content),
  heading: ({ node, text }) => text(node.props.content) || "Heading",
  // Rich text — inline-formatted HTML (gradient spans, links, <code>, …) that
  // plain `text` can't express. The author owns the markup (it's their content).
  richtext: ({ node, text }) => <div dangerouslySetInnerHTML={{ __html: text(node.props.html) }} />,
  link: ({ node, text }) => (
    <a href={text(node.props.href) || "#"} style={{ color: "inherit", textDecoration: "underline" }}>
      {text(node.props.content) || "link"}
    </a>
  ),
  divider: () => <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: 0 }} />,
  callout: ({ node, text }) => {
    const tone = ({ info: "#3b82f6", success: "#10b981", warning: "#f59e0b", danger: "#ef4444" } as Record<string, string>)[text(node.props.variant)] ?? "#3b82f6";
    return (
      <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 10, background: `${tone}14`, borderLeft: `3px solid ${tone}` }}>
        <span style={{ fontSize: 13 }}>{text(node.props.content) || "Callout"}</span>
      </div>
    );
  },
  code: ({ node, text }) => (
    <pre style={{ margin: 0, padding: "12px 14px", borderRadius: 10, background: "#0b1220", color: "#e2e8f0", fontFamily: "ui-monospace, monospace", fontSize: 13, overflowX: "auto" }}>
      <code>{text(node.props.content)}</code>
    </pre>
  ),
  button: ({ node, text }) => {
    const label = text(node.props.label) || text(node.props.content) || "Button";
    const variant = text(node.props.variant) || "primary";
    return <span data-cms-button={variant} style={buttonStyle(variant)}>{label}</span>;
  },
  image: ({ node, text }) => (
    <img
      src={text(node.props.src)}
      alt={text(node.props.alt)}
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
