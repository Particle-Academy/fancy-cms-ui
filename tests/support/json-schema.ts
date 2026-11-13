/**
 * A JSON Schema (draft 2020-12) checker for the subset the island catalogues
 * use: type, enum, const, anyOf, properties, required, additionalProperties,
 * items, prefixItems, minItems, maxItems, minimum, maximum, pattern and
 * `$ref: "#/$defs/..."`. Written here rather than added as a dependency (the
 * third-party rule); it fails loudly on any keyword it does not know, so a
 * schema it cannot check is never reported as valid.
 */
type Schema = Record<string, unknown>;

const KNOWN = new Set(["type", "enum", "const", "anyOf", "properties", "required", "additionalProperties", "items", "prefixItems", "minItems", "maxItems", "minimum", "maximum", "pattern", "$ref", "description", "default"]);

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function typeMatches(want: string, v: unknown): boolean {
  const t = typeOf(v);
  return want === t || (want === "number" && t === "integer");
}

/** The paths at which `value` breaks `schema`; empty when it is valid. */
export function validate(value: unknown, schema: Schema, defs: Record<string, Schema>, path = "$"): string[] {
  for (const k of Object.keys(schema)) if (!KNOWN.has(k)) throw new Error(`json-schema: unknown keyword "${k}" at ${path}`);
  if (typeof schema.$ref === "string") {
    const name = schema.$ref.replace("#/$defs/", "");
    const target = defs[name];
    if (!target) throw new Error(`json-schema: unknown $ref ${schema.$ref}`);
    return validate(value, target, defs, path);
  }
  if (Array.isArray(schema.anyOf)) {
    const ok = (schema.anyOf as Schema[]).some((s) => validate(value, s, defs, path).length === 0);
    return ok ? [] : [`${path}: matches no anyOf branch`];
  }
  const errors: string[] = [];
  if (schema.const !== undefined && JSON.stringify(schema.const) !== JSON.stringify(value)) errors.push(`${path}: not ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) errors.push(`${path}: not one of the enum`);
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
    if (!types.some((t) => typeMatches(t, value))) return [...errors, `${path}: expected ${types.join("|")}, got ${typeOf(value)}`];
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) errors.push(`${path}: below ${schema.minimum}`);
    if (typeof schema.maximum === "number" && value > schema.maximum) errors.push(`${path}: above ${schema.maximum}`);
  }
  if (typeof value === "string" && typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match ${schema.pattern}`);
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`);
    if (Array.isArray(schema.prefixItems)) (schema.prefixItems as Schema[]).forEach((s, i) => i < value.length && errors.push(...validate(value[i], s, defs, `${path}[${i}]`)));
    else if (schema.items && typeof schema.items === "object") value.forEach((v, i) => errors.push(...validate(v, schema.items as Schema, defs, `${path}[${i}]`)));
  }
  if (typeOf(value) === "object") {
    const obj = value as Record<string, unknown>;
    const props = (schema.properties ?? {}) as Record<string, Schema>;
    for (const r of (schema.required ?? []) as string[]) if (!(r in obj)) errors.push(`${path}.${r}: required`);
    for (const [k, v] of Object.entries(obj)) {
      if (props[k]) errors.push(...validate(v, props[k]!, defs, `${path}.${k}`));
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") errors.push(...validate(v, schema.additionalProperties as Schema, defs, `${path}.${k}`));
    }
  }
  return errors;
}
