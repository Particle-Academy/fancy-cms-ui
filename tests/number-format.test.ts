import { describe, expect, it } from "vitest";
import { formatNumber, formatSpec, groupThousands, signedNumber, toNumber, trimTrailingZeros } from "../src/render/number-format";

const spec = (source: Record<string, unknown>) => formatSpec(source);

describe("number formatting shared with the PHP renderer", () => {
  it("rounds half away from zero on the decimal digits, not on binary floats", () => {
    // 1.005 is 1.00499999999999989... in binary; toFixed(2) gives "1.00".
    expect(formatNumber(1.005, spec({ decimals: 2 }))).toBe("1.01");
    expect(formatNumber(999.995, spec({ format: "currency" }))).toBe("$1,000.00");
    expect(formatNumber(-2.5, spec({ decimals: 0 }))).toBe("-3");
    expect(formatNumber(0.07, spec({ format: "percent" }))).toBe("7%");
  });

  it("chooses automatic decimals without padding", () => {
    expect(formatNumber(3.14159, spec({}))).toBe("3.14");
    expect(formatNumber(3.999, spec({}))).toBe("4");
    expect(formatNumber(0.1234, spec({ format: "percent" }))).toBe("12.3%");
  });

  it("expands exponent notation in both directions", () => {
    expect(formatNumber(1.5e22, spec({}))).toBe("15,000,000,000,000,000,000,000");
    expect(formatNumber(1e-7, spec({ decimals: 6 }))).toBe("0.000000");
    expect(formatNumber(-1e-7, spec({ decimals: 6 }))).toBe("0.000000");
  });

  it("knows a handful of currency symbols and falls back to the code", () => {
    expect(formatNumber(1234, spec({ format: "currency", currency: "GBP" }))).toBe("£1,234.00");
    expect(formatNumber(1234, spec({ format: "currency", currency: "CHF" }))).toBe("CHF 1,234.00");
    expect(formatNumber(1234, spec({ format: "currency", currency: "usd" }))).toBe("$1,234.00");
    expect(formatNumber(1234.5, spec({ format: "currency", currency: "JPY" }))).toBe("¥1,235");
  });

  it("ignores decimals outside 0..6 or not an integer", () => {
    for (const decimals of [-1, 7, 1.5, "2", null]) expect(formatNumber(1.23456, spec({ decimals }))).toBe("1.23");
    expect(formatNumber(1.5, spec({ decimals: 2.0 }))).toBe("1.50");
  });

  it("signs a delta and never signs zero", () => {
    expect(signedNumber(0.1, spec({ format: "percent" }))).toBe("+10%");
    expect(signedNumber(-0.1, spec({ format: "percent" }))).toBe("-10%");
    expect(signedNumber(0.0001, spec({ format: "percent" }))).toBe("0%");
  });

  it("accepts finite numbers and plain decimal strings only", () => {
    expect(toNumber(12)).toBe(12);
    expect(toNumber("12.50")).toBe(12.5);
    expect(toNumber("-0.5")).toBe(-0.5);
    for (const bad of ["", " 1", "1e3", "0x10", "1.", ".5", "12\n", true, null, {}, [1], "9".repeat(400)]) expect(toNumber(bad), String(bad)).toBeNull();
  });
});

describe("digit-string helpers are linear (CodeQL js/polynomial-redos)", () => {
  // A finite number's digits are bounded (about 330), but the helpers take any
  // string, so they are held to linear time on one far longer than that.
  const N = 100_000;

  it("trims trailing zeros from a 100k-digit run ending in a non-zero quickly, and correctly", () => {
    const run = "0".repeat(N) + "1";
    const start = performance.now();
    expect(trimTrailingZeros(run)).toBe(run);
    expect(trimTrailingZeros("1" + "0".repeat(N))).toBe("1");
    expect(trimTrailingZeros("0".repeat(N))).toBe("");
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("matches what /0+$/ gave on ordinary input", () => {
    for (const s of ["", "0", "1", "10", "100", "105", "0001000", "123450"]) expect(trimTrailingZeros(s), s).toBe(s.replace(/0+$/, ""));
  });

  it("groups a 100k-digit integer quickly, and correctly", () => {
    const int = "1" + "0".repeat(N - 1);
    const start = performance.now();
    const out = groupThousands(int);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(out.length).toBe(N + Math.floor((N - 1) / 3));
    expect(out.replace(/,/g, "")).toBe(int);
    expect(out.startsWith("1,000,")).toBe(true);
  });

  it("groups exactly as the lookahead regex did", () => {
    for (let len = 1; len <= 12; len++) {
      const int = "123456789012".slice(0, len);
      expect(groupThousands(int), int).toBe(int.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    }
  });

  it("still formats the longest digit strings a number can have", () => {
    expect(formatNumber(1e300, spec({})).replace(/,/g, "")).toBe("1" + "0".repeat(300));
    expect(formatNumber(5e-324, spec({ decimals: 6 }))).toBe("0.000000");
    expect(formatNumber(1.5e-300, spec({}))).toBe("0");
  });
});
