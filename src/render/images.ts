/** Metadata comes from the host's immutable asset manifest, never page props. */
export interface ImageVariant {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

export interface ImageAsset extends ImageVariant {
  readonly variants?: readonly ImageVariant[];
  /** Required when variants are declared; the host owns the layout contract. */
  readonly sizes?: string;
}

/** Synchronous closed lookup. An unknown handle returns null, with no URL fallback. */
export type ImageAssetResolver = (handle: string) => ImageAsset | null | undefined;

interface ResolvedImage extends ImageVariant {
  srcSet?: string;
  sizes?: string;
}

const bytes = new TextEncoder();
function string(value: unknown, max: number): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > max || bytes.encode(value).length > max) return false;
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff) return false;
  }
  return true;
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const dimension = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 1_000_000;
function source(value: unknown): value is string {
  if (!string(value, 4096) || /[\u0000-\u0020\u007f,]/.test(value) || value.includes("\\")) return false;
  return value.startsWith("/") ? !value.startsWith("//") : /^https?:\/\/[^/?#]+(?:[/?#]|$)/i.test(value);
}
function variant(value: unknown): value is unknown & ImageVariant {
  return record(value) && ["src", "width", "height"].every(key => Object.prototype.hasOwnProperty.call(value, key))
    && source(value.src) && dimension(value.width) && dimension(value.height);
}

/** @internal Validate the full declared asset before returning any fetchable field. */
export function resolveImageAsset(handle: unknown, resolver?: ImageAssetResolver): ResolvedImage | null {
  if (!string(handle, 256) || typeof resolver !== "function") return null;
  const asset: unknown = resolver(handle);
  if (!variant(asset)) return null;
  const raw = asset as ImageAsset;
  const variants: unknown = Object.prototype.hasOwnProperty.call(raw, "variants") ? raw.variants : [];
  if (!Array.isArray(variants) || variants.length > 16) return null;
  const widths = new Set<number>(), sources = new Set<string>();
  for (const image of variants) {
    if (!variant(image)) return null;
    if (widths.has(image.width) || sources.has(image.src)) return null;
    widths.add(image.width); sources.add(image.src);
  }
  if (variants.length > 0 && (!string(raw.sizes, 2048) || !/[^\t\n\r ]/.test(raw.sizes))) return null;
  return {
    src: raw.src, width: raw.width, height: raw.height,
    ...(variants.length ? {
      srcSet: [...variants].sort((a, b) => a.width - b.width).map(image => `${image.src} ${image.width}w`).join(", "),
      sizes: raw.sizes,
    } : {}),
  };
}
