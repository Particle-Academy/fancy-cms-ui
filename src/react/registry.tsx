import type { ReactNode } from "react";
import { isBinding, type Bound, type Json, type Node, type PageDoc } from "../document/types";
import { validIconProps, type IconSet } from "../document/icons";
import { NativeIcon } from "./NativeIcon";

/** The page data context bindings resolve against (e.g. server props, repeater `item`). */
export type DataContext = Record<string, unknown>;

export interface ElementContext {
  node: Node;
  doc: PageDoc;
  /** Pre-rendered child nodes, in order. */
  children: ReactNode;
  /** The data context this node renders in (page data + any repeater scope). */
  data?: DataContext;
  /** Closed glyph data preloaded by the host, shared with SSR. */
  icons?: IconSet;
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

/** Landmark tags a container may opt into with `props.as`. Anything else is ignored. */
export const LANDMARK_TAGS = ["section", "header", "nav", "main", "footer", "article", "aside", "div"] as const;
const LANDMARKS = new Set<string>(LANDMARK_TAGS);
const CONTAINERS = new Set(["stack", "grid", "frame", "shape", "card"]);
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/**
 * An href an author or agent wrote, or null when it must not be rendered.
 * Relative URLs, fragments and http(s)/mailto/tel pass; every other scheme
 * (`javascript:`, `data:`, `vbscript:` ...) is dropped.
 */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  // Strip control characters and whitespace a browser ignores when it reads a scheme.
  const probe = href.replace(/[\u0000- \u007f]+/g, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(probe);
  if (scheme && !SAFE_SCHEMES.has(scheme[1]!.toLowerCase())) return null;
  return href;
}

/** What `props.anchor` must look like to become an `id`: a lowercase slug, 64 chars at most. */
export const ANCHOR_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/**
 * The in-page anchor a node declares (`props.anchor`), or null. Rendered as the
 * element's `id`, so `href="#pricing"` scrolls to it. Anything that is not a
 * lowercase slug is ignored rather than rendered.
 */
export function anchorFor(node: Node, text: (v: Bound<Json> | undefined) => string): string | null {
  const anchor = text(node.props.anchor);
  return ANCHOR_PATTERN.test(anchor) ? anchor : null;
}

/** The element a node renders as: its tag and the attributes that tag needs. */
export interface ElementSpec {
  tag: string;
  attrs?: Record<string, string>;
}

/**
 * Semantic element per node. The `[data-cms]` element IS this element, so the
 * node's emitted CSS styles the real heading, paragraph, link or landmark.
 */
export function elementFor(node: Node, text: (v: Bound<Json> | undefined) => string): ElementSpec {
  const as = text(node.props.as);
  switch (node.type) {
    case "icon":
      return { tag: "span", attrs: validIconProps(node.props) && !node.props.decorative
        ? { role: "img", "aria-label": node.props.label! }
        : { "aria-hidden": "true" } };
    case "heading": {
      const level = Number(text(node.props.level) || 2);
      return { tag: Number.isInteger(level) && level >= 1 && level <= 6 ? `h${level}` : "h2" };
    }
    case "text":
      return { tag: "p" };
    case "section":
      return { tag: LANDMARKS.has(as) ? as : "section" };
    case "list":
      return { tag: text(node.props.ordered) === "true" ? "ol" : "ul" };
    case "button":
    case "link": {
      const href = safeHref(text(node.props.href));
      const attrs: Record<string, string> = {};
      if (href !== null) {
        attrs.href = href;
        if (/^https?:\/\//i.test(href)) attrs.rel = "noopener noreferrer";
      }
      // The button's look is the base stylesheet's, keyed by this attribute.
      if (node.type === "button") attrs["data-cms-button"] = BUTTON_VARIANTS.has(text(node.props.variant)) ? text(node.props.variant) : "primary";
      return { tag: href !== null ? "a" : node.type === "link" ? "span" : "div", attrs };
    }
    case "callout": {
      const variant = text(node.props.variant);
      return { tag: "div", attrs: { "data-cms-callout": CALLOUT_VARIANTS.has(variant) ? variant : "info" } };
    }
    default:
      return { tag: CONTAINERS.has(node.type) && LANDMARKS.has(as) ? as : "div" };
  }
}

/** Built-in native elements. Containers render their children; leaves render content. */
export const defaultRegistry: ElementRegistry = {
  icon: ({ node, icons }) => <NativeIcon props={node.props} icons={icons} />,
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
  // The [data-cms] element is already the <a> (see elementFor), so a link renders its label only.
  link: ({ node, text }) => text(node.props.content) || "link",
  list: ({ node, resolve }) => {
    const items = resolve(node.props.items);
    return Array.isArray(items) ? items.map((item, i) => <li key={i}>{item === null || item === undefined ? "" : String(item)}</li>) : null;
  },
  // Looks come from the base stylesheet (render/css.ts BASE_CSS), never from
  // inline style objects, so the PHP renderer emits the same markup.
  divider: () => <hr />,
  callout: ({ node, text }) => text(node.props.content) || "Callout",
  code: ({ node, text }) => (
    <pre>
      <code>{text(node.props.content)}</code>
    </pre>
  ),
  button: ({ node, text }) => text(node.props.label) || text(node.props.content) || "Button",
  image: ({ node, text }) => {
    const fit = text(node.props.fit);
    return (
      <img
        src={text(node.props.src) || undefined}
        alt={text(node.props.alt)}
        loading={text(node.props.loading) === "eager" ? "eager" : "lazy"}
        data-cms-fit={IMAGE_FITS.has(fit) && fit !== "cover" ? fit : undefined}
      />
    );
  },
};

const IMAGE_FITS = new Set(["cover", "contain", "fill", "none", "scale-down"]);
const BUTTON_VARIANTS = new Set(["primary", "outline", "ghost"]);
const CALLOUT_VARIANTS = new Set(["info", "success", "warning", "danger"]);

