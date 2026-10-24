import { ICON_NAMES, ICON_SOURCE } from "./icon-names";

const knownNames = new Set(ICON_NAMES);

/** Closed native icon vocabulary. Documents may never supply SVG data. */
export function iconNames(): readonly string[] {
  return ICON_NAMES;
}

export type IconPrimitive = readonly [tag: string, attrs: Readonly<Record<string, string | number>>];

export type IconSet = Readonly<Record<string, readonly IconPrimitive[] | undefined>>;

/** Glyph data is host-owned, preloaded before rendering, never document input. */
export function iconGlyph(name: string, icons?: IconSet): readonly IconPrimitive[] | null {
  return icons && Object.prototype.hasOwnProperty.call(icons, name) ? icons[name] ?? null : null;
}

export interface IconSearch {
  source: string;
  names: string[];
  total: number;
  nextCursor: number | null;
}

export function searchIcons(query = "", cursor = 0): IconSearch {
  if (typeof query !== "string" || query.length > 128 || /[^A-Za-z0-9 -]/.test(query) || !Number.isSafeInteger(cursor) || cursor < 0) throw new TypeError("Invalid icon search.");
  const words = query.toLowerCase().split(/[ -]+/).filter(Boolean);
  const matches = ICON_NAMES.filter((name) => words.every((word) => name.includes(word)));
  const exact = words.join("-");
  if (knownNames.has(exact)) {
    matches.splice(matches.indexOf(exact), 1);
    matches.unshift(exact);
  }
  const names = matches.slice(cursor, cursor + 20);
  return { source: ICON_SOURCE, names, total: matches.length, nextCursor: cursor + names.length < matches.length ? cursor + names.length : null };
}

export interface IconProps {
  name: string;
  decorative: boolean;
  label?: string;
}

export function validIconProps(value: unknown): value is IconProps {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const props = value as Record<string, unknown>;
  if (Object.keys(props).some((key) => !["name", "decorative", "label"].includes(key))) return false;
  if (!Object.prototype.hasOwnProperty.call(props, "name") || !Object.prototype.hasOwnProperty.call(props, "decorative")) return false;
  if (typeof props.name !== "string" || !knownNames.has(props.name) || typeof props.decorative !== "boolean") return false;
  const hasLabel = Object.prototype.hasOwnProperty.call(props, "label");
  if (hasLabel && (typeof props.label !== "string" || new TextEncoder().encode(props.label).length > 1024 || /[\uD800-\uDFFF]/u.test(props.label))) return false;
  return props.decorative || (hasLabel && typeof props.label === "string" && /[^\x09-\x0D ]/u.test(props.label));
}
