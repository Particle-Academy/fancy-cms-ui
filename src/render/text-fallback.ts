/**
 * An island's text fallback: the content a kit island carries, as plain
 * paragraphs and lists, so it is in the first byte of the page and readable
 * before (or without) the component's code. FancyCms\Render\TextFallback writes
 * the same bytes (tests/fixtures/kit-islands.json).
 *
 * The catalogue names which props are content, as steps:
 *
 *   { "text": "title" }                          <p>title</p>
 *   { "list": "items", "fields": ["label"] }     <ul><li>label</li>...</ul>
 *   { "list": "keys" }                           <ul><li>key</li>...</ul> (scalar items)
 *   { "code": "code" }                           <pre><code>code</code></pre>
 *
 * A step whose prop is missing, empty or the wrong shape writes nothing. Item
 * fields that are present are joined with ": ". At most 100 list items.
 */
import type { Json } from "../document/types";

export type TextFallbackStep = { text: string } | { list: string; fields?: string[] } | { code: string };

export interface TextFallbackBlock {
  kind: "p" | "ul" | "pre";
  items: string[];
}

const MAX_ITEMS = 100;

function scalar(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** The blocks a fallback writes for these (resolved) props. */
export function textFallbackBlocks(steps: readonly TextFallbackStep[], props: Record<string, unknown>): TextFallbackBlock[] {
  const out: TextFallbackBlock[] = [];
  const own = (k: string) => (Object.prototype.hasOwnProperty.call(props, k) ? props[k] : undefined);
  for (const step of steps) {
    if ("text" in step) {
      const s = scalar(own(step.text));
      if (s !== "") out.push({ kind: "p", items: [s] });
    } else if ("code" in step) {
      const s = scalar(own(step.code));
      if (s !== "") out.push({ kind: "pre", items: [s] });
    } else if ("list" in step) {
      const list = own(step.list);
      if (!Array.isArray(list)) continue;
      const items: string[] = [];
      for (const item of list.slice(0, MAX_ITEMS)) {
        let s: string;
        if (step.fields && step.fields.length) {
          if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
          const rec = item as Record<string, unknown>;
          s = step.fields.map((f) => scalar(Object.prototype.hasOwnProperty.call(rec, f) ? rec[f] : undefined)).filter((x) => x !== "").join(": ");
        } else {
          s = scalar(item);
        }
        if (s !== "") items.push(s);
      }
      if (items.length) out.push({ kind: "ul", items });
    }
  }
  return out;
}

/** Whether a catalogue's textFallback is well formed. */
export function isTextFallback(v: Json | undefined): v is TextFallbackStep[] & Json {
  if (!Array.isArray(v)) return false;
  return v.every((s) => {
    if (typeof s !== "object" || s === null || Array.isArray(s)) return false;
    const keys = Object.keys(s);
    if (keys.length === 1 && (keys[0] === "text" || keys[0] === "code")) return typeof (s as Record<string, Json>)[keys[0]!] === "string";
    if (keys.includes("list") && keys.every((k) => k === "list" || k === "fields")) {
      const f = (s as Record<string, Json>).fields;
      return typeof (s as Record<string, Json>).list === "string" && (f === undefined || (Array.isArray(f) && f.every((x) => typeof x === "string")));
    }
    return false;
  });
}
