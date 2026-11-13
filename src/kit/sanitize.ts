/**
 * Island props as a kit component receives them: only what the catalogue's
 * schema declares, data only, and URLs that pass the renderer's scheme check.
 *
 * The schema already says this to an agent; this is the render-time half, so a
 * document written by anything else (an old editor, a hand edit, a hostile
 * import) cannot reach a component with a prop the catalogue never offered.
 */
import type { JsonSchema } from "../islands/catalogue";
import { safeHref } from "../react/registry";

/** Prop names, at any depth, whose string value is a URL. */
export const URL_KEYS = new Set(["src", "href", "poster", "url", "image", "avatar", "pdfUrl", "citeUrl", "brandHref", "hrefPattern", "thumbnail", "logo", "icon_url", "imageUrl", "videoUrl", "audioUrl"]);

const MAX_DEPTH = 24;

/** A URL a page may use: relative, or http(s), mailto or tel. Never `data:` except images, never `javascript:`. */
export function safeUrl(raw: string, key: string): string | null {
  const href = safeHref(raw);
  if (href === null) {
    // An inline image (a QR code, an avatar a host generated) is data, not code.
    if ((key === "src" || key === "image" || key === "avatar" || key === "poster") && /^data:image\/(png|jpeg|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(raw.trim())) return raw.trim();
    return null;
  }
  return href;
}

function clean(value: unknown, key: string, depth: number): unknown {
  if (depth > MAX_DEPTH) return undefined;
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") return undefined;
  if (typeof value === "string") return URL_KEYS.has(key) ? (safeUrl(value, key) ?? undefined) : value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (value === null || typeof value === "boolean" || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => clean(v, key, depth + 1)).filter((v) => v !== undefined);
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return undefined;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      const c = clean(v, k, depth + 1);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return undefined;
}

/** The props a component may receive: declared by `schema`, cleaned. */
export function sanitizeProps(props: Record<string, unknown>, schema: JsonSchema): Record<string, unknown> {
  const declared = schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties) ? (schema.properties as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (!Object.prototype.hasOwnProperty.call(declared, key)) continue;
    const c = clean(props[key], key, 0);
    if (c !== undefined) out[key] = c;
  }
  return out;
}
