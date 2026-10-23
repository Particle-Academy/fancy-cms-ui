/**
 * Own-property access for maps keyed by op-supplied strings.
 *
 * Node ids and breakpoint names arrive in ops, and an agent writes the ops. On
 * a plain object, `nodes["constructor"]` is Object.prototype's constructor and
 * `nodes["__proto__"] = node` replaces the map's prototype instead of adding a
 * node. These helpers see only what the document actually holds. (A computed
 * key in an object literal, `{ [id]: node }`, already creates an own property
 * even for "__proto__", so spreads need no help.)
 */

const has = Object.prototype.hasOwnProperty;

/** The entry the map really holds under `key`, or undefined. */
export function own<T>(map: Record<string, T> | undefined | null, key: string): T | undefined {
  return map != null && has.call(map, key) ? map[key] : undefined;
}

/** Whether the map really holds `key`. */
export function hasOwn(map: Record<string, unknown> | undefined | null, key: string): boolean {
  return map != null && has.call(map, key);
}

/** Write `key` as an own, enumerable data property, whatever the key is. */
export function setOwn<T>(map: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(map, key, { value, writable: true, enumerable: true, configurable: true });
}
