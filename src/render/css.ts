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

/** Map StyleProps → CSS declarations (property → value). */
function styleDecls(style: Partial<StyleProps>): Record<string, string> {
  const d: Record<string, string> = {};
  if (style.padding) d["padding"] = lengthToCss(style.padding);
  if (style.margin) d["margin"] = lengthToCss(style.margin);
  if (style.radius) d["border-radius"] = lengthToCss(style.radius);
  if (style.background !== undefined) d["background"] = style.background;
  if (style.color !== undefined) d["color"] = style.color;
  if (style.opacity !== undefined) d["opacity"] = String(style.opacity);
  if (style.fontFamily !== undefined) d["font-family"] = style.fontFamily;
  if (style.fontSize) d["font-size"] = lengthToCss(style.fontSize);
  if (style.fontWeight !== undefined) d["font-weight"] = String(style.fontWeight);
  if (style.lineHeight !== undefined) d["line-height"] = String(style.lineHeight);
  if (style.textAlign !== undefined) d["text-align"] = style.textAlign;
  if (style.letterSpacing) d["letter-spacing"] = lengthToCss(style.letterSpacing);
  if (style.border !== undefined) d["border"] = style.border;
  if (style.boxShadow !== undefined) d["box-shadow"] = style.boxShadow;
  if (style.transform !== undefined) d["transform"] = style.transform;
  if (style.filter !== undefined) d["filter"] = style.filter;
  if (style.gap) d["gap"] = lengthToCss(style.gap);
  if (style.align !== undefined) d["align-items"] = ALIGN[style.align] ?? style.align;
  if (style.justify !== undefined) d["justify-content"] = JUSTIFY[style.justify] ?? style.justify;
  return d;
}

/** Container behaviour from `node.layout`. */
function layoutDecls(node: Node): Record<string, string> {
  const d: Record<string, string> = {};
  if (node.layout === "stack") {
    d["display"] = "flex";
    d["flex-direction"] = node.style.base.direction ?? "column";
  } else if (node.layout === "grid") {
    d["display"] = "grid";
    d["grid-template-columns"] = `repeat(${node.style.base.columns ?? 1}, 1fr)`;
  } else if (node.layout === "free") {
    d["position"] = "relative";
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
  const breakpointPx = DEFAULT_BREAKPOINTS;
  const blocks: string[] = [];

  for (const id of Object.keys(doc.nodes).sort()) {
    const node = doc.nodes[id]!;
    const selector = selectorFor(id);
    const parentFree = isParentFree(doc, node);

    // base = style.base + layout + constraints.base
    const base: Record<string, string> = {
      ...layoutDecls(node),
      ...(node.constraints ? constraintDecls(node.constraints.base, parentFree) : {}),
      ...styleDecls(node.style.base),
    };
    const baseRule = serializeRule(selector, base, "");
    if (baseRule) blocks.push(baseRule);

    // per-breakpoint overrides (mobile-first, in doc order, skipping base)
    for (const bp of doc.breakpoints) {
      if (bp === "base") continue;
      const px = breakpointPx[bp];
      if (px === undefined) continue;
      const decls: Record<string, string> = {
        ...(node.constraints?.[bp] ? constraintDecls(node.constraints[bp]!, parentFree) : {}),
        ...(node.style[bp] ? styleDecls(node.style[bp]!) : {}),
      };
      const inner = serializeRule(selector, decls, "  ");
      if (inner) blocks.push(`@media (min-width: ${px}px) {\n${inner}\n}`);
    }
  }

  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}
