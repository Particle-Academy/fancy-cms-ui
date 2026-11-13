/**
 * The `echart` node's option: a SAFE SUBSET of an ECharts option, validated the
 * same way here and in PHP (`FancyCms\Render\EchartOption`), against a shared
 * fixture (tests/fixtures/echart-options.json).
 *
 * An ECharts option can carry code and markup: formatter functions, tooltip
 * HTML, rich text, extra CSS, image URLs, links. A document is data an agent or
 * a visitor-facing editor wrote, so none of that may pass:
 *
 * - only the top-level keys in TOP_LEVEL, and only the series types in SERIES;
 * - no key in DENIED, at any depth (rich text, CSS, links, images, DOM targets);
 * - every string is free of `<` and `>`, `javascript:`, `url(` and `image://`;
 * - a `formatter` is a plain template string (`{b}: {c}`), never code;
 * - `{ "$bind": path }` is a data slot wherever a value goes, and the option is
 *   validated again once its bindings have resolved;
 * - nesting stops at MAX_DEPTH.
 *
 * Pure, so the server, the client and the tests share it.
 */
import type { Json } from "../document/types";

export const ECHART_TOP_LEVEL = new Set([
  "title", "legend", "grid", "xAxis", "yAxis", "polar", "radiusAxis", "angleAxis", "radar", "dataZoom", "visualMap",
  "tooltip", "axisPointer", "dataset", "series", "color", "backgroundColor", "textStyle", "animation", "animationDuration",
  "animationEasing", "animationDelay", "animationDurationUpdate", "animationEasingUpdate", "animationThreshold", "darkMode",
  "calendar", "parallel", "parallelAxis", "singleAxis", "useUTC",
]);

export const ECHART_SERIES = new Set([
  "line", "bar", "pie", "scatter", "effectScatter", "radar", "tree", "treemap", "sunburst", "boxplot", "candlestick",
  "heatmap", "parallel", "graph", "sankey", "funnel", "gauge", "pictorialBar", "themeRiver",
]);

export const ECHART_DENIED = new Set([
  "rich", "extraCssText", "link", "sublink", "target", "subtarget", "image", "appendTo", "appendToBody", "renderMode",
  "className", "graphic", "toolbox", "geo", "map", "html", "constructor", "prototype", "__proto__",
]);

const MAX_DEPTH = 12;
const MAX_NODES = 20000;
const BINDING_KEYS = new Set(["$bind", "$source", "$params", "$scope"]);
const CODE = /\bfunction\b|=>|\$\{|\beval\b|\bnew\s|\breturn\b/;

function unsafeString(s: string): boolean {
  const lower = s.toLowerCase();
  return s.includes("<") || s.includes(">") || lower.includes("javascript:") || lower.includes("url(") || lower.startsWith("image://");
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isBindingShape(v: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(v, "$bind");
}

/**
 * The JSON paths the option breaks a rule at, in document order; empty when it
 * is accepted. With `bindings: false` (after resolution) a `$bind` is an error.
 */
export function validateEchartOption(option: unknown, { bindings = true }: { bindings?: boolean } = {}): string[] {
  const errors: string[] = [];
  if (!isPlainObject(option)) return ["$"];
  let nodes = 0;

  const walk = (value: unknown, path: string, depth: number, key: string | null): void => {
    if (++nodes > MAX_NODES) {
      if (errors[errors.length - 1] !== "$") errors.push("$");
      return;
    }
    if (depth > MAX_DEPTH) {
      errors.push(path);
      return;
    }
    if (key === "formatter") {
      if (typeof value !== "string" || unsafeString(value) || CODE.test(value)) errors.push(path);
      return;
    }
    if (typeof value === "string") {
      if (unsafeString(value)) errors.push(path);
      return;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) errors.push(path);
      return;
    }
    if (value === null || typeof value === "boolean") return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1, null));
      return;
    }
    if (!isPlainObject(value)) {
      errors.push(path);
      return;
    }
    if (isBindingShape(value)) {
      const ok = bindings && typeof value.$bind === "string" && Object.keys(value).every((k) => BINDING_KEYS.has(k));
      if (!ok) errors.push(path);
      return;
    }
    for (const [k, v] of Object.entries(value)) {
      const at = `${path}.${k}`;
      if (ECHART_DENIED.has(k)) {
        errors.push(at);
        continue;
      }
      walk(v, at, depth + 1, k);
    }
  };

  const seriesItem = (item: unknown, path: string): void => {
    if (!isPlainObject(item)) {
      walk(item, path, 2, null);
      return;
    }
    const type = item.type;
    if (typeof type !== "string" || !ECHART_SERIES.has(type)) errors.push(`${path}.type`);
    for (const [k, v] of Object.entries(item)) {
      if (k === "type") continue;
      const at = `${path}.${k}`;
      if (ECHART_DENIED.has(k)) {
        errors.push(at);
        continue;
      }
      walk(v, at, 3, k);
    }
  };

  for (const [k, v] of Object.entries(option)) {
    const at = `$.${k}`;
    if (!ECHART_TOP_LEVEL.has(k)) {
      errors.push(at);
      continue;
    }
    if (k === "series") {
      if (Array.isArray(v)) v.forEach((item, i) => seriesItem(item, `${at}[${i}]`));
      else if (isPlainObject(v) && !isBindingShape(v)) seriesItem(v, at);
      else walk(v, at, 1, k);
      continue;
    }
    walk(v, at, 1, k);
  }
  return errors;
}

/** Graphic element types an EChartGraphic island may draw: shapes and text, never images. */
export const ECHART_GRAPHIC_TYPES = new Set(["group", "rect", "circle", "ring", "sector", "arc", "polygon", "polyline", "line", "bezierCurve", "text"]);

/**
 * The paths a list of ECharts graphic elements breaks a rule at: the option
 * rules (no markup, no CSS, no links, no images) plus an allow-listed `type`
 * on every element, children of a group included.
 */
export function validateGraphicElements(elements: unknown): string[] {
  if (!Array.isArray(elements)) return ["$"];
  const errors: string[] = [];
  const check = (el: unknown, path: string): void => {
    if (!isPlainObject(el)) {
      errors.push(path);
      return;
    }
    if (typeof el.type !== "string" || !ECHART_GRAPHIC_TYPES.has(el.type)) errors.push(`${path}.type`);
    const { children, type, ...rest } = el;
    void type;
    for (const e of validateEchartOption({ title: rest })) errors.push(e.replace(/^\$\.title/, path));
    if (children !== undefined) {
      if (!Array.isArray(children)) errors.push(`${path}.children`);
      else children.forEach((c, i) => check(c, `${path}.children[${i}]`));
    }
  };
  elements.forEach((el, i) => check(el, `$[${i}]`));
  return errors;
}

/** Resolve every `{ $bind }` in a value, at any depth, against a data reader. */
export function resolveDeep(value: unknown, read: (path: string) => unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => resolveDeep(v, read));
  if (isPlainObject(value)) {
    if (isBindingShape(value) && typeof value.$bind === "string") return read(value.$bind);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveDeep(v, read);
    return out;
  }
  return value;
}

export interface EchartTheme {
  colors: string[];
  text: string;
  rule: string;
}

/**
 * The option handed to ECharts: the validated, resolved option with the page's
 * theme filled in where the author set none, tooltips in rich-text mode (never
 * HTML), no ECharts aria layer (the figure's summary is the text alternative),
 * and no animation under reduced motion.
 */
export function echartRenderOption(option: Record<string, unknown>, theme: EchartTheme, reducedMotion: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = { ...option };
  if (out.color === undefined) out.color = theme.colors;
  out.textStyle = { color: theme.text, ...(isPlainObject(out.textStyle) ? out.textStyle : {}) };
  const tooltip = isPlainObject(out.tooltip) ? out.tooltip : out.tooltip === undefined ? undefined : {};
  if (tooltip) out.tooltip = { ...tooltip, renderMode: "richText", confine: true };
  out.aria = { enabled: false };
  if (reducedMotion) out.animation = false;
  return out;
}

/** The node's props as the renderers read them. */
export function echartModel(props: Record<string, unknown>): { title: string; summary: string; height: number; option: Json | undefined } {
  const text = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
  const h = typeof props.height === "number" && Number.isFinite(props.height) ? props.height : 320;
  return { title: text(props.title), summary: text(props.summary), height: Math.min(800, Math.max(160, Math.round(h))), option: props.option as Json | undefined };
}
