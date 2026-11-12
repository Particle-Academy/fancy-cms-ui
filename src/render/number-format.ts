/**
 * Number formatting for the infographic nodes, mirrored byte-for-byte by the PHP
 * renderer (`FancyCms\Render\NumberFormat`).
 *
 * Not `Intl.NumberFormat`: its output depends on the ICU build of whichever
 * runtime renders the page, and PHP's `NumberFormatter` carries a different ICU
 * again, so a server-rendered tile and a browser-rendered tile could disagree on
 * a grouping space or a currency glyph. This works on the shortest round-trip
 * decimal string of the number (`String(n)`, which the PHP side reproduces
 * exactly) and rounds on those digits, half away from zero, so `1.005` rounds
 * to `1.01` in both — a binary `toFixed` gives `1.00`.
 *
 * English conventions only: `,` groups, `.` is the decimal point.
 */

export type NumberFormatKind = "number" | "currency" | "percent";

export interface NumberFormatSpec {
  format: NumberFormatKind;
  currency: string;
  /** Fixed decimals, or null for automatic (no padding, capped). */
  decimals: number | null;
}

const KINDS = new Set<string>(["number", "currency", "percent"]);
const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", INR: "₹", CAD: "CA$", AUD: "A$" };
const ZERO_DECIMAL = new Set(["JPY", "KRW"]);
const PLAIN = /^-?\d+(\.\d+)?$/;

/** A finite number from a number or a plain decimal string; anything else is null. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && PLAIN.test(value)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** A fixed-decimals value: an integer 0..6. */
export function decimalsOf(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6 ? value : null;
}

/** Read `format` / `currency` / `decimals` from props (already resolved). */
export function formatSpec(source: { format?: unknown; currency?: unknown; decimals?: unknown }, fallback: NumberFormatKind = "number"): NumberFormatSpec {
  const format = typeof source.format === "string" && KINDS.has(source.format) ? (source.format as NumberFormatKind) : fallback;
  const currency = typeof source.currency === "string" && /^[A-Z]{3}$/.test(source.currency) ? source.currency : "USD";
  return { format, currency, decimals: decimalsOf(source.decimals) };
}

interface Digits {
  negative: boolean;
  int: string;
  frac: string;
}

function digitsOf(n: number): Digits {
  const s = String(n);
  const negative = s.startsWith("-");
  const body = negative ? s.slice(1) : s;
  const [mantissa, exponent] = body.split("e");
  const [ip, fp = ""] = mantissa!.split(".");
  const digits = ip! + fp;
  const point = ip!.length + (exponent === undefined ? 0 : Number(exponent));
  let int: string;
  let frac: string;
  if (point <= 0) {
    int = "0";
    frac = "0".repeat(-point) + digits;
  } else if (point >= digits.length) {
    int = digits + "0".repeat(point - digits.length);
    frac = "";
  } else {
    int = digits.slice(0, point);
    frac = digits.slice(point);
  }
  return { negative, int: stripLeading(int), frac };
}

function stripLeading(int: string): string {
  const s = int.replace(/^0+/, "");
  return s === "" ? "0" : s;
}

function increment(digits: string): string {
  const out = digits.split("");
  let i = out.length - 1;
  for (; i >= 0; i--) {
    if (out[i] === "9") {
      out[i] = "0";
    } else {
      out[i] = String.fromCharCode(out[i]!.charCodeAt(0) + 1);
      break;
    }
  }
  return i < 0 ? "1" + out.join("") : out.join("");
}

function round(d: Digits, places: number, fixed: boolean): Digits {
  let { int, frac } = d;
  if (frac.length > places) {
    let keep = int + frac.slice(0, places);
    if (frac.charCodeAt(places) >= 53) keep = increment(keep);
    int = stripLeading(keep.slice(0, keep.length - places));
    frac = keep.slice(keep.length - places);
  }
  frac = fixed ? frac.padEnd(places, "0") : frac.replace(/0+$/, "");
  return { negative: d.negative, int, frac };
}

interface Formatted {
  text: string;
  negative: boolean;
  zero: boolean;
}

function format(n: number, spec: NumberFormatSpec): Formatted {
  let d = digitsOf(n);
  if (spec.format === "percent") {
    const frac = d.frac.padEnd(2, "0");
    d = { negative: d.negative, int: stripLeading(d.int + frac.slice(0, 2)), frac: frac.slice(2) };
  }
  const auto = spec.format === "percent" ? 1 : 2;
  const places = spec.decimals ?? (spec.format === "currency" ? (ZERO_DECIMAL.has(spec.currency) ? 0 : 2) : auto);
  const fixed = spec.decimals !== null || spec.format === "currency";
  const r = round(d, places, fixed);
  const zero = /^0*$/.test(r.int + r.frac);
  const negative = r.negative && !zero;
  const body = r.int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (r.frac ? "." + r.frac : "");
  const sign = negative ? "-" : "";
  const text =
    spec.format === "percent"
      ? `${sign}${body}%`
      : spec.format === "currency"
        ? `${sign}${SYMBOLS[spec.currency] ?? spec.currency + " "}${body}`
        : `${sign}${body}`;
  return { text, negative, zero };
}

/** Format a finite number. */
export function formatNumber(n: number, spec: NumberFormatSpec): string {
  return format(n, spec).text;
}

/** Format a change: `+` on a positive result, `-` on a negative one, no sign on zero. */
export function signedNumber(n: number, spec: NumberFormatSpec): string {
  const f = format(n, spec);
  return f.negative || f.zero ? f.text : "+" + f.text;
}
