import {hasNodeMap,type PageDoc} from "../document/types";

export type FontSource = "bundled" | "google";
export type FontStyle = "normal" | "italic";
/** Authored family request. URLs and CSS belong to the host, never this value. */
export type FontReference = {
  family: string;
  source: FontSource;
  weights: number[];
  styles?: FontStyle[];
};
/** Short form for theme authors. */
export type FontRef = FontReference;
export interface ResolvedFontReference {
  family: string;
  source: FontSource;
  weights: readonly number[];
  styles: readonly FontStyle[];
}
export interface FontFaceAsset {
  src: string;
  sha256: string;
  weight: number | readonly [number,number];
  style: FontStyle;
  unicodeRange?: string;
}
/** Immutable host manifest. Faces retain their supplied unicode-shard order. */
export interface FontAsset {
  family: string;
  source: FontSource;
  manifestSha256: string;
  faces: readonly FontFaceAsset[];
}
export type FontAssetResolver = (reference: Readonly<ResolvedFontReference>) => FontAsset | null | undefined;
export interface FontRenderOptions {
  fontResolver?: FontAssetResolver;
  /** Trusted host policy; not an authored theme token. Captures use block. */
  fontDisplay?: "swap" | "block";
}
export type FontResolutionReason = "invalid-reference" | "too-many-fonts" | "missing-resolver" | "resolver-failed" | "missing-font" | "invalid-asset" | "missing-face" | "invalid-display";
export class FontResolutionException extends Error {
  constructor(readonly reason: FontResolutionReason) {
    super(`CMS font resolution failed: ${reason}`);
    this.name = "FontResolutionException";
  }
}
const fail = (reason: FontResolutionReason): never => {throw new FontResolutionException(reason);};
const record = (value: unknown): value is Record<string,unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const weight = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1000;
const style = (value: unknown): value is FontStyle => value === "normal" || value === "italic";
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

/** Deliberately canonical path subset. No percent decoding, query, dot segments or CSS escapes. */
function fontPath(value: unknown): value is string {
  return typeof value === "string" && value.length <= 1024 && /^\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.woff2$/.test(value);
}

function normalizeReference(value: unknown): Readonly<ResolvedFontReference> {
  if (!record(value) || Object.keys(value).some(k=>!["family","source","weights","styles"].includes(k))) return fail("invalid-reference");
  const {family,source,weights}=value,styles=value.styles === undefined ? ["normal"] : value.styles;
  if (typeof family !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 ._+-]{0,99}$/.test(family) || family.trim() !== family ||
      (source !== "bundled" && source !== "google") || !Array.isArray(weights) || weights.length < 1 || weights.length > 16 ||
      !Array.isArray(styles) || styles.length < 1 || styles.length > 2) return fail("invalid-reference");
  // Array.from makes holes explicit, unlike every/map on sparse arrays.
  const ws=Array.from(weights),ss=Array.from(styles);
  if (!ws.every(weight) || new Set(ws).size !== ws.length || !ss.every(style) || new Set(ss).size !== ss.length) return fail("invalid-reference");
  return Object.freeze({family,source,weights:Object.freeze(ws.sort((a,b)=>a-b)),styles:Object.freeze(ss.sort())});
}

/** Canonical CSS unicode ranges, with scalar and range bounds checked numerically. */
function unicodeRange(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.length > 8192 || /[^\x00-\x7f]/.test(value)) return fail("invalid-asset");
  const ranges=value.split(",");
  if (ranges.length > 256) return fail("invalid-asset");
  return ranges.map(part=>{
    const range=part.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g,"").toUpperCase();
    if (!/^U\+(?:[0-9A-F]{1,6}(?:-[0-9A-F]{1,6})?|[0-9A-F]{0,5}\?{1,6})$/.test(range)) return fail("invalid-asset");
    const [left,right]=range.slice(2).split("-");
    if (left!.length > 6) return fail("invalid-asset");
    const low=parseInt(left!.replace(/\?/g,"0"),16),high=parseInt(right ?? left!.replace(/\?/g,"F"),16);
    if (low > high || high > 0x10ffff) return fail("invalid-asset");
    return range;
  }).join(", ");
}

function normalizeAsset(value: unknown,ref: ResolvedFontReference): FontAsset {
  if (!record(value) || value.family !== ref.family || value.source !== ref.source || !digest(value.manifestSha256) ||
      !Array.isArray(value.faces) || value.faces.length < 1 || value.faces.length > 256) return fail("invalid-asset");
  const faces:FontFaceAsset[]=Array.from(value.faces).map(face=>{
    if (!record(face) || !fontPath(face.src) || !digest(face.sha256) || !style(face.style)) return fail("invalid-asset");
    let range:number | readonly [number,number];
    if (weight(face.weight)) range=face.weight;
    else if (Array.isArray(face.weight) && face.weight.length === 2 && weight(face.weight[0]) && weight(face.weight[1]) && face.weight[0] < face.weight[1]) range=[face.weight[0],face.weight[1]];
    else return fail("invalid-asset");
    const unicode=unicodeRange(face.unicodeRange);
    return {src:face.src,sha256:face.sha256,weight:range,style:face.style,...(unicode === undefined ? {} : {unicodeRange:unicode})};
  });
  for (const requestedStyle of ref.styles ?? ["normal"]) for (const requestedWeight of ref.weights) {
    if (!faces.some(face=>face.style === requestedStyle && (typeof face.weight === "number" ? face.weight === requestedWeight : face.weight[0] <= requestedWeight && face.weight[1] >= requestedWeight))) return fail("missing-face");
  }
  return {family:ref.family,source:ref.source,manifestSha256:value.manifestSha256,faces};
}

/** Internal prepared data is local to one render; never cached across page revisions. */
export interface PreparedFonts { aliases: ReadonlyMap<string,string>; blocks: readonly string[] }
export function prepareDocFonts(doc: PageDoc,options: FontRenderOptions = {}): PreparedFonts {
  const aliases=new Map<string,string>();
  if (!hasNodeMap(doc)) return {aliases,blocks:[]};
  const theme:unknown=doc.theme;
  if (!record(theme) || !record(theme.font)) return {aliases,blocks:[]};
  const requests=new Map<string,{ref:Readonly<ResolvedFontReference>;tokens:string[]}>(),families=new Set<string>();
  for (const [token,value] of Object.entries(theme.font)) {
    if (typeof value !== "object" || value === null) continue; // legacy scalar tokens keep their old bytes
    const ref=normalizeReference(value),key=JSON.stringify(ref);
    families.add(`${ref.source}:${ref.family}`);
    if (families.size > 8 || requests.size >= 32 && !requests.has(key)) return fail("too-many-fonts");
    const prior=requests.get(key);
    if (prior) prior.tokens.push(token); else requests.set(key,{ref,tokens:[token]});
  }
  if (requests.size === 0) return {aliases,blocks:[]};
  const display=options.fontDisplay ?? "swap";
  if (display !== "swap" && display !== "block") return fail("invalid-display");
  if (typeof options.fontResolver !== "function") return fail("missing-resolver");
  const blocks:string[]=[],seen=new Set<string>(),manifests=new Map<string,string>();
  for (const key of [...requests.keys()].sort()) {
    const {ref,tokens}=requests.get(key)!;
    let raw:unknown;
    try {raw=options.fontResolver(ref);} catch {return fail("resolver-failed");}
    if (raw === null || raw === undefined) return fail("missing-font");
    const asset=normalizeAsset(raw,ref),alias=`cms-font-${asset.manifestSha256}`;
    const canonical=JSON.stringify(asset),prior=manifests.get(alias);
    if (prior !== undefined && prior !== canonical) return fail("invalid-asset");
    manifests.set(alias,canonical);
    for (const token of tokens) aliases.set(token,alias);
    for (const face of asset.faces) {
      const css=`@font-face {\n  font-display: ${display};\n  font-family: "${alias}";\n  font-style: ${face.style};\n  font-weight: ${typeof face.weight === "number" ? face.weight : face.weight.join(" ")};\n  src: url("${face.src}") format("woff2");${face.unicodeRange === undefined ? "" : `\n  unicode-range: ${face.unicodeRange};`}\n}`;
      if (!seen.has(css)) {seen.add(css);blocks.push(css);}
    }
  }
  blocks.push(":where([data-cms]) {\n  font-optical-sizing: none;\n  font-synthesis: none;\n}");
  return {aliases,blocks};
}
