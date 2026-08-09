/**
 * Stages document model — see `fancy-ui/docs/fancy-cms.md` §4.
 *
 * A page is a vertical stack of full-bleed **sections**; inside each, **layers**
 * are positioned by constraints (free + bold stays responsive), with stack/grid
 * containers where structure is wanted. Nodes live in a **flat map** keyed by id
 * (Figma-style) so ops target a stable identity and collab merges stay clean.
 */

import type { DocNode, DocTree } from "@particle-academy/fancy-doc-commons";

/** A node id. Alias of doc-commons' `DocId`, kept for readability in CMS code. */
export type NodeId = string;

export type ScrollMode = "snap" | "smooth";

/** Ordered, mobile-first. Convention: `"base" | "md" | "lg"`. */
export type Breakpoint = string;

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** A literal value OR a binding into the page's data context (`{ $bind: "profile.coins" }`). */
export interface Binding {
  $bind: string;
  /**
   * Which live query this path reads from — `["catalog", "products"]`.
   *
   * Optional: a host-supplied static context is still legitimate, and every
   * document saved before this has no `$source`.
   *
   * When present it is the Live Contract's vocabulary — the same
   * `[namespace, resource, …]` shape `fancy-query`'s `liveKey()` produces —
   * NOT a CMS-local name. See `./bindings` for why that matters and for
   * `bindingSources()`, which answers "what does this page depend on?".
   */
  $source?: readonly (string | number)[];
}
export type Bound<T> = T | Binding;

export function isBinding(v: unknown): v is Binding {
  return typeof v === "object" && v !== null && typeof (v as Binding).$bind === "string";
}

// ── Sizing ────────────────────────────────────────────────────────────────

export type LengthUnit = "px" | "%" | "vw" | "vh" | "rem" | "fr";
export interface Length {
  value: number;
  unit: LengthUnit;
}
export type SizeMode = Length | "fill" | "hug";

export interface Constraints {
  /** Pinned offsets within a `free` parent (null = unpinned). */
  left?: Length | null;
  right?: Length | null;
  top?: Length | null;
  bottom?: Length | null;
  centerX?: boolean;
  centerY?: boolean;
  width: SizeMode;
  height: SizeMode;
}

export type LayoutMode = "free" | "stack" | "grid";

// ── Style (compiles deterministically to CSS in both emitters) ──────────────

export interface StyleProps {
  // box
  padding?: Length;
  margin?: Length;
  radius?: Length;
  // color / surface
  background?: string; // color | gradient | url(...)
  color?: string;
  opacity?: number;
  // typography
  fontFamily?: string;
  fontSize?: Length;
  fontWeight?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  letterSpacing?: Length;
  // border / shadow / effects (static)
  border?: string;
  boxShadow?: string;
  transform?: string;
  filter?: string;
  // container knobs (when layout = stack | grid)
  gap?: Length;
  direction?: "row" | "column";
  columns?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
}

/** Per-breakpoint overrides; `base` is required, others cascade mobile-first. */
export type PerBreakpoint<T> = { base: T } & Partial<Record<Breakpoint, Partial<T>>>;

// ── Animation (typed for Phase 2; ignored by the static CSS emitter) ────────

export type AnimDriver = "enter" | "scroll" | "loop" | "hover" | "click" | "drag";
export interface Keyframe {
  at: number; // 0..1
  props: Record<string, number | string>;
}
export interface Anim {
  id: string;
  driver: AnimDriver;
  keyframes: Keyframe[];
  range?: { start: number; end: number };
  ease?: string;
  duration?: number;
  delay?: number;
  stagger?: number;
  once?: boolean;
  emit?: "css" | "js";
}

// ── Actions (typed for Phase 3/4) ───────────────────────────────────────────

export type ActionEvent = "click" | "submit" | "change" | "load" | "timer" | "scroll-into" | "hover";
export type ActionHandler =
  | { kind: "navigate"; href: Bound<string> }
  | { kind: "submitForm"; endpoint: string; method?: "post" | "put" }
  | { kind: "mutate"; target: string; value: Bound<Json> }
  | { kind: "callEndpoint"; endpoint: string; method?: string }
  | { kind: "runFlow"; flow: string }
  | { kind: "openModal"; node: NodeId }
  | { kind: "openDrawer"; node: NodeId }
  | { kind: "playTimeline"; section: NodeId }
  | { kind: "toggleNode"; node: NodeId };
export interface Action {
  on: ActionEvent;
  do: ActionHandler;
}

// ── Nodes & document ────────────────────────────────────────────────────────

/**
 * A page node.
 *
 * Extends {@link DocNode} from `fancy-doc-commons` rather than redeclaring it:
 * id / type / parent / order / props are the shared substrate every Fancy
 * document surface uses, and the CMS adds its own domain fields on top. That
 * is what lets `registerDocBridge` drive a CMS page and a fancy-screens screen
 * through the same tools, with no CMS-specific bridge.
 */
export interface Node extends DocNode<Record<string, Bound<Json>>> {
  /** Addon key: `section | text | image | shape | stack | grid | frame | <addon>`. */
  type: string;
  /** How this node arranges its children. */
  layout?: LayoutMode;
  /** How this node positions itself within its parent. */
  constraints?: PerBreakpoint<Constraints>;
  style: PerBreakpoint<StyleProps>;
  animations?: Anim[];
  actions?: Action[];
  /** Repeater: render this node once per item of a bound array. */
  repeat?: { each: Binding; as: string };
  /**
   * Host CSS class(es) applied to the node's element. The migration enabler:
   * reuse the host site's existing stylesheet for pixel-perfect reproduction
   * instead of re-deriving every rule through {@link StyleProps}.
   */
  className?: string;
  /** Derived from the addon manifest — interactive/3rd-party ⇒ hydration island. */
  island?: boolean;
}

export interface ThemeTokens {
  name?: string;
  [key: string]: Json | undefined;
}

export interface PageMeta {
  title: string;
  slug: string;
  scrollMode: ScrollMode;
  seo?: Record<string, string>;
}

export interface PageDoc {
  id: string;
  /** Op counter — collab ordering + revision checkpoints. */
  seq: number;
  meta: PageMeta;
  theme: ThemeTokens;
  /** Ordered, mobile-first. */
  breakpoints: Breakpoint[];
  /**
   * Flat map — not a nested tree. This is a {@link DocTree}, so every
   * doc-commons walk (`childrenOf`, `roots`, `descendantsOf`) works on it
   * directly.
   *
   * There is no separate `sections[]` any more. Top-level order used to live in
   * its own array while every other level used fractional `order` keys, which
   * meant two ordering mechanisms that could disagree — a node could be a root
   * by `parent === null` and absent from `sections`, and then simply not
   * render. Roots are now ordered exactly like any other sibling group.
   */
  nodes: Record<NodeId, Node>;
}

/** Default breakpoint → min-width (px) map. `base` has no media query. */
export const DEFAULT_BREAKPOINTS: Record<string, number> = {
  base: 0,
  md: 768,
  lg: 1024,
};

/** A minimal empty document. */
export function emptyDoc(id: string, slug = "/"): PageDoc {
  return {
    id,
    seq: 0,
    meta: { title: "Untitled", slug, scrollMode: "smooth" },
    theme: { name: "default" },
    breakpoints: ["base", "md", "lg"],
    nodes: {},
  };
}
