/**
 * The JS style → CSS emitter (one half of the dual-emitter pair; the PHP
 * `particle-academy/fancy-cms` mirrors it byte-for-byte). Output is
 * **deterministic**: declarations are sorted, selectors and media blocks use a
 * fixed format, and nodes are emitted in sorted-id order — so the parity harness
 * can diff the two engines' CSS exactly.
 *
 * Phase 0 covers the static subset (layout / constraints / style). Motion lands
 * in Phase 2.
 */
import {
  DEFAULT_BREAKPOINTS,
  hasNodeMap,
  type Constraints,
  type Length,
  type Node,
  type PageDoc,
  type SizeMode,
  type StyleProps,
} from "../document/types";

const selectorFor = (id: string): string => `[data-cms="${id}"]`;

function lengthToCss(len: Length): string {
  return `${len.value}${len.unit}`;
}

function sizeToCss(size: SizeMode): string {
  if (size === "fill") return "100%";
  if (size === "hug") return "auto";
  return lengthToCss(size);
}

const ALIGN: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};
const JUSTIFY: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};

/**
 * A free-form value is written into a declaration verbatim, so it must not be
 * able to end that declaration or rule: no `{`, `}` or `<` anywhere, and no `;`
 * outside parentheses or quotes (`url(data:image/svg+xml;base64,…)` stays
 * legal). Returns null for a value that would escape; the declaration is then
 * dropped. The PHP emitter applies the identical rule.
 */
export function safeCssValue(value: string): string | null {
  if (/[{}<]/.test(value)) return null;
  let depth = 0;
  let quote: string | null = null;
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
    } else if (ch === ";" && depth === 0) {
      return null;
    }
  }
  return value;
}

function put(d: Record<string, string>, prop: string, value: string | undefined): void {
  if (value === undefined) return;
  const safe = safeCssValue(value);
  if (safe !== null) d[prop] = safe;
}

const OVERFLOW = new Set(["visible", "hidden", "auto"]);
const TEXT_TRANSFORM = new Set(["none", "uppercase", "lowercase", "capitalize"]);
const BACKGROUND_SIZE = new Set(["cover", "contain", "auto"]);

/** Map StyleProps → CSS declarations (property → value). Container knobs are in {@link containerDecls}. */
function styleDecls(style: Partial<StyleProps>): Record<string, string> {
  const d: Record<string, string> = {};
  if (style.padding) d["padding"] = lengthToCss(style.padding);
  if (style.paddingX) d["padding-left"] = d["padding-right"] = lengthToCss(style.paddingX);
  if (style.paddingY) d["padding-top"] = d["padding-bottom"] = lengthToCss(style.paddingY);
  if (style.margin) d["margin"] = lengthToCss(style.margin);
  if (style.marginX) d["margin-left"] = d["margin-right"] = style.marginX === "auto" ? "auto" : lengthToCss(style.marginX);
  if (style.marginY) d["margin-top"] = d["margin-bottom"] = lengthToCss(style.marginY);
  if (style.radius) d["border-radius"] = lengthToCss(style.radius);
  if (style.maxWidth) d["max-width"] = lengthToCss(style.maxWidth);
  if (style.minHeight) d["min-height"] = lengthToCss(style.minHeight);
  put(d, "aspect-ratio", style.aspectRatio);
  if (style.sticky === true) {
    d["position"] = "sticky";
    d["top"] = "0";
  }
  if (typeof style.zIndex === "number" && Number.isFinite(style.zIndex)) d["z-index"] = String(Math.trunc(style.zIndex));
  if (style.overflow !== undefined && OVERFLOW.has(style.overflow)) d["overflow"] = style.overflow;
  put(d, "background", style.background);
  if (style.backgroundSize !== undefined && BACKGROUND_SIZE.has(style.backgroundSize)) d["background-size"] = style.backgroundSize;
  put(d, "background-position", style.backgroundPosition);
  put(d, "color", style.color);
  if (style.opacity !== undefined) d["opacity"] = String(style.opacity);
  put(d, "font-family", style.fontFamily);
  if (style.fontSize) d["font-size"] = lengthToCss(style.fontSize);
  if (style.fontWeight !== undefined) d["font-weight"] = String(style.fontWeight);
  if (style.lineHeight !== undefined) d["line-height"] = String(style.lineHeight);
  put(d, "text-align", style.textAlign);
  if (style.letterSpacing) d["letter-spacing"] = lengthToCss(style.letterSpacing);
  if (style.textTransform !== undefined && TEXT_TRANSFORM.has(style.textTransform)) d["text-transform"] = style.textTransform;
  put(d, "border", style.border);
  put(d, "box-shadow", style.boxShadow);
  put(d, "transform", style.transform);
  put(d, "filter", style.filter);
  if (style.gap) d["gap"] = lengthToCss(style.gap);
  if (style.align !== undefined) d["align-items"] = ALIGN[style.align] ?? style.align;
  if (style.justify !== undefined) d["justify-content"] = JUSTIFY[style.justify] ?? style.justify;
  return d;
}

/** The display value a node has when it is NOT hidden. */
function shownDisplay(node: Node): string {
  if (node.layout === "stack") return "flex";
  if (node.layout === "grid") return "grid";
  return "block";
}

function gridColumns(style: Partial<StyleProps>): string | undefined {
  if (style.columnMin) return `repeat(auto-fit, minmax(min(${lengthToCss(style.columnMin)}, 100%), 1fr))`;
  if (style.columns !== undefined) return `repeat(${Math.max(1, Math.trunc(style.columns))}, 1fr)`;
  return undefined;
}

/**
 * Container behaviour. At `base` the layout's display and defaults apply; at a
 * breakpoint only what that breakpoint's style changes is emitted, so a grid can
 * go 1 -> 2 -> 3 columns and a stack column -> row.
 */
function containerDecls(node: Node, style: Partial<StyleProps>, isBase: boolean): Record<string, string> {
  const d: Record<string, string> = {};
  if (node.layout === "stack") {
    if (isBase) d["display"] = "flex";
    if (isBase || style.direction !== undefined) d["flex-direction"] = style.direction ?? "column";
    if (style.wrap !== undefined) d["flex-wrap"] = style.wrap ? "wrap" : "nowrap";
  } else if (node.layout === "grid") {
    if (isBase) d["display"] = "grid";
    const cols = gridColumns(style);
    if (isBase || cols !== undefined) d["grid-template-columns"] = cols ?? "repeat(1, 1fr)";
  } else if (node.layout === "free" && isBase) {
    d["position"] = "relative";
  }
  return d;
}

/** `hidden` decides `display` last, over the layout's own display. */
function visibilityDecls(node: Node, style: Partial<StyleProps>, isBase: boolean): Record<string, string> {
  if (style.hidden === true) return { display: "none" };
  if (style.hidden === false && !isBase) return { display: shownDisplay(node) };
  return {};
}

/**
 * Theme tokens as custom properties: `{ color: { primary } }` -> `--cms-color-primary`.
 * `name` labels the theme and is not a token. Keys are reduced to `[a-z0-9-]`;
 * values must be strings or numbers and pass {@link safeCssValue}.
 */
function themeDecls(theme: unknown): Record<string, string> {
  const d: Record<string, string> = {};
  const walk = (value: unknown, path: string[]): void => {
    if (typeof value === "string" || typeof value === "number") {
      const key = path.map((p) => p.toLowerCase().replace(/[^a-z0-9-]/g, "")).filter(Boolean).join("-");
      if (key) put(d, `--cms-${key}`, String(value));
      return;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, [...path, k]);
    }
  };
  if (typeof theme === "object" && theme !== null && !Array.isArray(theme)) {
    for (const [k, v] of Object.entries(theme as Record<string, unknown>)) {
      if (k !== "name") walk(v, [k]);
    }
  }
  return d;
}

/** Self-positioning from constraints (absolute pins only inside a `free` parent). */
function constraintDecls(c: Partial<Constraints>, parentFree: boolean): Record<string, string> {
  const d: Record<string, string> = {};
  const transforms: string[] = [];
  if (parentFree) {
    d["position"] = "absolute";
    if (c.left) d["left"] = lengthToCss(c.left);
    if (c.right) d["right"] = lengthToCss(c.right);
    if (c.top) d["top"] = lengthToCss(c.top);
    if (c.bottom) d["bottom"] = lengthToCss(c.bottom);
    if (c.centerX) {
      d["left"] = "50%";
      transforms.push("translateX(-50%)");
    }
    if (c.centerY) {
      d["top"] = "50%";
      transforms.push("translateY(-50%)");
    }
    if (transforms.length) d["transform"] = transforms.join(" ");
  }
  if (c.width) d["width"] = sizeToCss(c.width);
  if (c.height) d["height"] = sizeToCss(c.height);
  return d;
}

function isParentFree(doc: PageDoc, node: Node): boolean {
  if (node.parent === null) return false; // sections stack in the page flow
  const parent = doc.nodes[node.parent];
  return !parent || parent.layout === undefined || parent.layout === "free";
}

function serializeRule(selector: string, decls: Record<string, string>, indent: string): string {
  const props = Object.keys(decls).sort();
  if (props.length === 0) return "";
  const body = props.map((p) => `${indent}  ${p}: ${decls[p]};`).join("\n");
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

/** Emit the full stylesheet for a document. Deterministic. */
export function emitDocCss(doc: PageDoc): string {
  if (!hasNodeMap(doc)) return "";

  const breakpointPx = DEFAULT_BREAKPOINTS;
  const blocks: string[] = [];

  const themeRule = serializeRule(":root", themeDecls((doc as { theme?: unknown }).theme), "");
  if (themeRule) blocks.push(themeRule);

  for (const id of Object.keys(doc.nodes).sort()) {
    const node = doc.nodes[id]!;
    const selector = selectorFor(id);
    const parentFree = isParentFree(doc, node);

    // base = layout, then constraints.base, then style.base (later wins), then visibility
    const base: Record<string, string> = {
      ...containerDecls(node, node.style.base, true),
      ...(node.constraints ? constraintDecls(node.constraints.base, parentFree) : {}),
      ...styleDecls(node.style.base),
      ...visibilityDecls(node, node.style.base, true),
    };
    const baseRule = serializeRule(selector, base, "");
    if (baseRule) blocks.push(baseRule);

    // per-breakpoint overrides (mobile-first, in doc order, skipping base)
    for (const bp of doc.breakpoints) {
      if (bp === "base") continue;
      const px = breakpointPx[bp];
      if (px === undefined) continue;
      const bpStyle = node.style[bp];
      const decls: Record<string, string> = {
        ...(bpStyle ? containerDecls(node, bpStyle, false) : {}),
        ...(node.constraints?.[bp] ? constraintDecls(node.constraints[bp]!, parentFree) : {}),
        ...(bpStyle ? styleDecls(bpStyle) : {}),
        ...(bpStyle ? visibilityDecls(node, bpStyle, false) : {}),
      };
      const inner = serializeRule(selector, decls, "  ");
      if (inner) blocks.push(`@media (min-width: ${px}px) {\n${inner}\n}`);
    }
  }

  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}
