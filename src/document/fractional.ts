/**
 * Minimal collab-safe fractional ordering keys.
 *
 * Sibling `order` is a string over a base-62 alphabet interpreted as a fraction
 * in (0, 1). `keyBetween(a, b)` returns a key that sorts strictly between `a`
 * and `b` (lexicographically), extending precision when the bounds are
 * adjacent. Concurrent inserts at the same spot produce different keys (vary by
 * actor), so reorders never collide.
 *
 * This is intentionally compact for Phase 0. Before live collaboration ships it
 * should be swapped for a hardened implementation with jitter + bucket bounds.
 */

const BASE = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const RADIX = BASE.length; // 62
const MID = Math.floor(RADIX / 2);

function val(c: string): number {
  const i = BASE.indexOf(c);
  return i < 0 ? 0 : i;
}

/**
 * Return a key strictly between `a` and `b`. Pass `null` for an open bound
 * (`keyBetween(null, null)` for the first key, `keyBetween(last, null)` to
 * append, `keyBetween(null, first)` to prepend).
 */
export function keyBetween(a: string | null, b: string | null): string {
  if (a === null) a = "";
  if (b === null) {
    // Append: a key greater than `a`. Appending a mid digit always sorts after.
    return a + BASE[MID];
  }
  if (a >= b) {
    throw new Error(`keyBetween: lower bound "${a}" is not below upper bound "${b}"`);
  }

  let result = "";
  let i = 0;
  // Walk the common prefix, then split at the first differing digit.
  for (;;) {
    const ca = i < a.length ? val(a[i] as string) : 0;
    const cb = i < b.length ? val(b[i] as string) : RADIX;
    if (cb - ca > 1) {
      result += BASE[ca + Math.floor((cb - ca) / 2)];
      return result;
    }
    if (ca === cb) {
      result += BASE[ca];
      i++;
      continue;
    }
    // Adjacent digits (cb - ca === 1): take the lower path, then descend into
    // `a`'s remainder with RADIX as the upper bound until a gap opens.
    result += BASE[ca];
    i++;
    for (;;) {
      const da = i < a.length ? val(a[i] as string) : 0;
      if (RADIX - da > 1) {
        result += BASE[da + Math.floor((RADIX - da) / 2)];
        return result;
      }
      result += BASE[da];
      i++;
    }
  }
}
