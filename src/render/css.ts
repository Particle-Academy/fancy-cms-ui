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
  withNodeDefaults,
  type Constraints,
  type Length,
  type Node,
  type PageDoc,
  type StyleProps,
} from "../document/types";
import { own } from "../document/own";
import {prepareDocFonts,type FontRenderOptions} from "./fonts";

/**
 * A string as the contents of a double-quoted CSS string. `\` and `"` are
 * backslash-escaped; control characters, and `<` (so an id can never write
 * `</style>` into an inline stylesheet), become hex escapes followed by a
 * space. The selector still matches the attribute's real value.
 */
export function cssString(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (ch === "\\" || ch === '"') out += `\\${ch}`;
    else if (code < 0x20 || code === 0x7f || ch === "<") out += `\\${code.toString(16)} `;
    else out += ch;
  }
  return out;
}

const selectorFor = (id: string): string => `[data-cms="${cssString(id)}"]`;

/**
 * The fixed base stylesheet, emitted first by every page and mirrored
 * byte-for-byte by the PHP emitter.
 *
 * It replaces the inline style objects the JS renderer used to attach to
 * buttons, callouts, code, dividers and images, which the PHP renderer could
 * not reproduce, and it resets the user-agent margins that stacked on top of a
 * layout's `gap`. Every selector is wrapped in `:where()` and is never more
 * specific than a node's own `[data-cms="<id>"]` rule, and comes before it, so
 * whatever a node sets wins.
 */
export const BASE_CSS = [
  "/* fancy-cms base */",
  ":where([data-cms]) {\n  box-sizing: border-box;\n}",
  ":where(h1, h2, h3, h4, h5, h6, p, ul, ol)[data-cms] {\n  margin: 0;\n}",
  ":where(ul, ol)[data-cms] {\n  padding-left: 1.25em;\n}",
  ":where(a[data-cms]) {\n  color: inherit;\n}",
  ":where([data-react-fancy-icon]) {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  flex-shrink: 0;\n  width: 1em;\n  height: 1em;\n  vertical-align: middle;\n}",
  ":where([data-cms] > img) {\n  display: block;\n  height: 100%;\n  object-fit: cover;\n  width: 100%;\n}",
  ':where([data-cms] > img[data-cms-fit="contain"]) {\n  object-fit: contain;\n}',
  ':where([data-cms] > img[data-cms-fit="fill"]) {\n  object-fit: fill;\n}',
  ':where([data-cms] > img[data-cms-fit="none"]) {\n  object-fit: none;\n}',
  ':where([data-cms] > img[data-cms-fit="scale-down"]) {\n  object-fit: scale-down;\n}',
  ":where([data-cms-button]) {\n  align-items: center;\n  border: 1px solid var(--cms-color-primary, #7c3aed);\n  border-radius: 8px;\n  cursor: pointer;\n  display: inline-flex;\n  font-weight: 600;\n  gap: 6px;\n  justify-content: center;\n  line-height: 1.2;\n  padding: 10px 18px;\n  text-decoration: none;\n}",
  ':where([data-cms-button="primary"]) {\n  background: var(--cms-color-primary, #7c3aed);\n  color: #ffffff;\n}',
  ':where([data-cms-button="outline"]) {\n  background: transparent;\n  color: var(--cms-color-primary, #7c3aed);\n}',
  ':where([data-cms-button="ghost"]) {\n  background: transparent;\n  border-color: currentColor;\n  color: inherit;\n}',
  ":where([data-cms-callout]) {\n  background: #3b82f614;\n  border-left: 3px solid #3b82f6;\n  border-radius: 10px;\n  padding: 12px 14px;\n}",
  ':where([data-cms-callout="success"]) {\n  background: #10b98114;\n  border-left-color: #10b981;\n}',
  ':where([data-cms-callout="warning"]) {\n  background: #f59e0b14;\n  border-left-color: #f59e0b;\n}',
  ':where([data-cms-callout="danger"]) {\n  background: #ef444414;\n  border-left-color: #ef4444;\n}',
  ":where([data-cms] > hr) {\n  border: none;\n  border-top: 1px solid #e2e8f0;\n  margin: 0;\n}",
  ":where([data-cms] > pre) {\n  background: #0b1220;\n  border-radius: 10px;\n  color: #e2e8f0;\n  font-family: ui-monospace, monospace;\n  font-size: 13px;\n  margin: 0;\n  overflow-x: auto;\n  padding: 12px 14px;\n}",
].join("\n\n");

const UNITS = new Set(["px", "%", "vw", "vh", "rem", "fr"]);

/** A Length as CSS, or null unless its value is a finite number and its unit a known one. */
function lengthToCss(len: unknown): string | null {
  if (typeof len !== "object" || len === null) return null;
  const { value, unit } = len as Length;
  if (typeof value !== "number" || !Number.isFinite(value) || typeof unit !== "string" || !UNITS.has(unit)) return null;
  return `${value}${unit}`;
}

function sizeToCss(size: unknown): string | null {
  if (size === "fill") return "100%";
  if (size === "hug") return "auto";
  return lengthToCss(size);
}

/** A finite number as CSS, or null. */
function numberToCss(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function putLen(d: Record<string, string>, props: string[], len: unknown): void {
  const css = lengthToCss(len);
  if (css !== null) for (const p of props) d[p] = css;
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
const TEXT_ALIGN = new Set(["left", "center", "right", "justify"]);
const DIRECTIONS = new Set(["row", "column"]);

/** An allowlisted keyword, or null. Keys are looked up as own properties only. */
function keyword(map: Record<string, string>, value: unknown): string | null {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(map, value) ? map[value]! : null;
}

function inSet(set: Set<string>, value: unknown): string | null {
  return typeof value === "string" && set.has(value) ? value : null;
}

/**
 * Map StyleProps → CSS declarations (property → value). Container knobs are in
 * {@link containerDecls}. Every value passes one of three gates: a Length with a
 * known unit and a finite number, an allowlisted keyword, or
 * {@link safeCssValue} for the free-form colours, borders and font stacks.
 * Anything else emits nothing.
 */
function styleDecls(style: Partial<StyleProps>): Record<string, string> {
  const d: Record<string, string> = {};
  putLen(d, ["padding"], style.padding);
  putLen(d, ["padding-left", "padding-right"], style.paddingX);
  putLen(d, ["padding-top", "padding-bottom"], style.paddingY);
  putLen(d, ["margin"], style.margin);
  if (style.marginX === "auto") d["margin-left"] = d["margin-right"] = "auto";
  else putLen(d, ["margin-left", "margin-right"], style.marginX);
  putLen(d, ["margin-top", "margin-bottom"], style.marginY);
  putLen(d, ["border-radius"], style.radius);
  putLen(d, ["max-width"], style.maxWidth);
  putLen(d, ["min-height"], style.minHeight);
  put(d, "aspect-ratio", typeof style.aspectRatio === "string" ? style.aspectRatio : undefined);
  if (style.sticky === true) {
    d["position"] = "sticky";
    d["top"] = "0";
  }
  if (typeof style.zIndex === "number" && Number.isFinite(style.zIndex)) d["z-index"] = String(Math.trunc(style.zIndex));
  const overflow = inSet(OVERFLOW, style.overflow);
  if (overflow) d["overflow"] = overflow;
  put(d, "background", typeof style.background === "string" ? style.background : undefined);
  const backgroundSize = inSet(BACKGROUND_SIZE, style.backgroundSize);
  if (backgroundSize) d["background-size"] = backgroundSize;
  put(d, "background-position", typeof style.backgroundPosition === "string" ? style.backgroundPosition : undefined);
  put(d, "color", typeof style.color === "string" ? style.color : undefined);
  const opacity = numberToCss(style.opacity);
  if (opacity !== null) d["opacity"] = opacity;
  put(d, "font-family", typeof style.fontFamily === "string" ? style.fontFamily : undefined);
  putLen(d, ["font-size"], style.fontSize);
  const fontWeight = numberToCss(style.fontWeight);
  if (fontWeight !== null) d["font-weight"] = fontWeight;
  const lineHeight = numberToCss(style.lineHeight);
  if (lineHeight !== null) d["line-height"] = lineHeight;
  const textAlign = inSet(TEXT_ALIGN, style.textAlign);
  if (textAlign) d["text-align"] = textAlign;
  putLen(d, ["letter-spacing"], style.letterSpacing);
  const textTransform = inSet(TEXT_TRANSFORM, style.textTransform);
  if (textTransform) d["text-transform"] = textTransform;
  put(d, "border", typeof style.border === "string" ? style.border : undefined);
  put(d, "box-shadow", typeof style.boxShadow === "string" ? style.boxShadow : undefined);
  put(d, "transform", typeof style.transform === "string" ? style.transform : undefined);
  put(d, "filter", typeof style.filter === "string" ? style.filter : undefined);
  putLen(d, ["gap"], style.gap);
  const align = keyword(ALIGN, style.align);
  if (align) d["align-items"] = align;
  const justify = keyword(JUSTIFY, style.justify);
  if (justify) d["justify-content"] = justify;
  return d;
}

/** The display value a node has when it is NOT hidden. */
function shownDisplay(node: Node): string {
  if (node.layout === "stack") return "flex";
  if (node.layout === "grid") return "grid";
  return "block";
}

function gridColumns(style: Partial<StyleProps>): string | undefined {
  const min = lengthToCss(style.columnMin);
  if (min !== null) return `repeat(auto-fit, minmax(min(${min}, 100%), 1fr))`;
  if (typeof style.columns === "number" && Number.isFinite(style.columns)) return `repeat(${Math.max(1, Math.trunc(style.columns))}, 1fr)`;
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
    const direction = inSet(DIRECTIONS, style.direction);
    if (isBase || direction) d["flex-direction"] = direction ?? "column";
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
function themeDecls(theme: unknown, fonts: ReadonlyMap<string,string>): Record<string, string> {
  const d: Record<string, string> = {};
  const walk = (value: unknown, path: string[]): void => {
    if (path.length === 2 && path[0] === "font" && fonts.has(path[1]!)) {
      value = `"${fonts.get(path[1]!)}"`;
    }
    if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
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
    putLen(d, ["left"], c.left);
    putLen(d, ["right"], c.right);
    putLen(d, ["top"], c.top);
    putLen(d, ["bottom"], c.bottom);
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
  const width = sizeToCss(c.width);
  if (width !== null) d["width"] = width;
  const height = sizeToCss(c.height);
  if (height !== null) d["height"] = height;
  return d;
}

function isParentFree(doc: PageDoc, node: Node): boolean {
  if (node.parent === null) return false; // sections stack in the page flow
  const parent = own(doc.nodes, node.parent);
  return !parent || parent.layout === undefined || parent.layout === "free";
}

function serializeRule(selector: string, decls: Record<string, string>, indent: string): string {
  const props = Object.keys(decls).sort();
  if (props.length === 0) return "";
  const body = props.map((p) => `${indent}  ${p}: ${decls[p]};`).join("\n");
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

/** Emit the full stylesheet for a document. Deterministic. */
export function emitDocCss(doc: PageDoc, options: FontRenderOptions = {}): string {
  if (!hasNodeMap(doc)) return "";

  const breakpointPx = DEFAULT_BREAKPOINTS;
  const fonts=prepareDocFonts(doc,options);
  const blocks: string[] = [...fonts.blocks];

  const themeRule = serializeRule(":root", themeDecls((doc as { theme?: unknown }).theme,fonts.aliases), "");
  if (themeRule) blocks.push(themeRule);

  for (const id of Object.keys(doc.nodes).sort()) {
    const node = withNodeDefaults(doc.nodes[id]!);
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
      // Own-property lookups: a breakpoint named "constructor" must not read
      // Object.prototype and print a function into a media query.
      const px = own(breakpointPx, bp);
      if (typeof px !== "number") continue;
      const bpStyle = own(node.style as Record<string, Partial<StyleProps>>, bp);
      const bpConstraints = node.constraints ? own(node.constraints as Record<string, Partial<Constraints>>, bp) : undefined;
      const decls: Record<string, string> = {
        ...(bpStyle ? containerDecls(node, bpStyle, false) : {}),
        ...(bpConstraints ? constraintDecls(bpConstraints, parentFree) : {}),
        ...(bpStyle ? styleDecls(bpStyle) : {}),
        ...(bpStyle ? visibilityDecls(node, bpStyle, false) : {}),
      };
      const inner = serializeRule(selector, decls, "  ");
      if (inner) blocks.push(`@media (min-width: ${px}px) {\n${inner}\n}`);
    }
  }

  // An empty document (no nodes, no tokens) emits nothing at all; anything
  // else gets the base first, even when no node sets a style of its own.
  if (blocks.length === 0 && Object.keys(doc.nodes).length === 0) return "";
  return [BASE_CSS, ...blocks].join("\n\n") + "\n";
}
