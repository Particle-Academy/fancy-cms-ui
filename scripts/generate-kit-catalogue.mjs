#!/usr/bin/env node
/**
 * Generates the kit island catalogue (src/kit/catalogue.json) from
 * src/kit/manifest.json and the REAL prop types of each kit component, read
 * with the TypeScript compiler from the installed packages' declarations.
 *
 *   node scripts/generate-kit-catalogue.mjs           write it
 *   node scripts/generate-kit-catalogue.mjs --check   exit 1 when it is stale
 *
 * Why generated: a schema typed by hand drifts the day a component's props
 * change, and nothing notices. Here a changed prop changes the output, and the
 * drift test (tests/kit-catalogue-drift.test.ts) fails until it is regenerated.
 *
 * What survives from a component's props is data only:
 * - string, number, boolean, literal unions, arrays, plain objects, records;
 * - a ReactNode prop becomes a string (text, which React escapes);
 * - functions, elements, refs, styles, DOM types, Dates and class instances
 *   are dropped, and so is any prop whose name is on DENY.
 * An adapter's own content props (a Tabs island's `tabs`) come from the manifest.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const ts = require("typescript");

const MANIFEST = join(root, "src/kit/manifest.json");
const OUT = join(root, "src/kit/catalogue.json");
const FAMILIES = join(root, "src/kit/families.json");
const BUILTIN = join(root, "src/islands/catalogue.json");

/** Never island props: looks come from the theme, handles from the node id, and no markup or code. */
export const DENY = new Set([
  "children", "className", "classNames", "style", "id", "as", "ref", "key",
  "html", "unsafe", "dangerouslySetInnerHTML", "extensions", "clipboardWriter",
  "provider", "adapter", "storage", "registry", "activity", "api", "executors",
  "theme", "frameProps", "imageProps", "videoProps", "audioProps", "pdfProps",
  "previewProps", "linkComponent", "linkAs", "contentOptions", "fieldRenderers",
  "humanFieldRenderers", "labelClassName", "cardClassName", "trackClassName",
  "fillClassName", "openClassName", "closedClassName", "cellClassName",
  "previewClassName", "placeholderClassName", "pasteClassNames", "triggerClassName",
  "scriptUrl", "scriptSrc", "workerUrl", "workerSrc", "engine", "controller", "audioRef", "file",
  "barClassName", "bodyClassName",
]);

const DEPTH = 5;

/**
 * Label and message overrides (i18n) keep their component's English defaults
 * unless set, and their key lists are long; they are described as a string map
 * rather than spelled out, so the catalogue stays readable by an agent.
 */
const LABELS = /^(labels|messages|stateLabels|copyLabels)$|Labels$/;
const LABELS_SCHEMA = { type: "object", additionalProperties: { type: "string" }, description: "label overrides by key; the English defaults apply to any key not set" };

const labelsOr = (name, s) => (s !== null && LABELS.test(name) && s.type === "object" ? LABELS_SCHEMA : s);

/** Dropped at any depth: looks, markup and handles to code. */
const NESTED_DENY = new Set(["className", "classNames", "style", "html", "unsafe", "dangerouslySetInnerHTML", "ref", "scriptUrl", "scriptSrc", "workerUrl", "workerSrc"]);

export const PLACEABLE = new Set(["page", "chrome", "data"]);

/** A manifest row with its defaults: module `@particle-academy/<package>`, export = the type's name. */
export function normalise(c) {
  const [pkg, name] = c.type.split(":");
  return { ...c, package: pkg, module: c.module ?? `@particle-academy/${pkg}`, export: c.export ?? name };
}

export function generate() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const builtin = JSON.parse(readFileSync(BUILTIN, "utf8"));
  const examples = JSON.parse(readFileSync(join(root, "src/kit/examples.json"), "utf8")).examples;
  const placeable = manifest.components.filter((c) => PLACEABLE.has(c.class)).map(normalise);

  const modules = [...new Set(placeable.filter((c) => c.derive !== false).map((c) => c.module))].sort();
  const entry = join(root, "__kit_catalogue_entry__.ts");
  const source = modules.map((m, i) => `import * as M${i} from ${JSON.stringify(m)};\nexport { M${i} };`).join("\n");
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, lang, ...rest) => (resolve(file) === entry ? ts.createSourceFile(file, source, lang) : getSourceFile(file, lang, ...rest));
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (file) => resolve(file) === entry || fileExists(file);
  const readFile = host.readFile.bind(host);
  host.readFile = (file) => (resolve(file) === entry ? source : readFile(file));
  const program = ts.createProgram([entry], options, host);
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(entry);

  const moduleSymbols = new Map();
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) moduleSymbols.set(st.moduleSpecifier.text, checker.getSymbolAtLocation(st.moduleSpecifier));
  }

  const isReactNode = (t) => {
    const alias = t.aliasSymbol?.getName();
    return alias === "ReactNode";
  };
  const isNonData = (t) => {
    if (t.getCallSignatures().length > 0 || t.getConstructSignatures().length > 0) return true;
    const name = (t.aliasSymbol ?? t.getSymbol())?.getName() ?? "";
    return /^(ReactElement|ReactPortal|JSXElementConstructor|Element|CSSProperties|RefObject|MutableRefObject|Ref|LegacyRef|Date|Map|Set|WeakMap|Promise|File|Blob|FileList|URL|HTMLElement|Node|Event|ComponentType|ElementType|FunctionComponent|ExoticComponent)$/.test(name) || /^HTML\w*Element$|Event$/.test(name);
  };

  function docOf(symbol) {
    const text = ts.displayPartsToString(symbol.getDocumentationComment(checker)).replace(/\s+/g, " ").trim();
    if (!text) return undefined;
    const first = text.split(/(?<=\.)\s/)[0];
    return first.length > 160 ? `${first.slice(0, 157)}...` : first;
  }

  /** JSON Schema for a type, or null when it carries no data. */
  function toSchema(t, depth, seen) {
    if (isReactNode(t)) return { type: "string" };
    // Recursive shapes (a JSON value type) stop here as "any JSON".
    if (depth > DEPTH + 1) return {};
    if (t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return {};
    if (t.isTypeParameter()) return {};
    if (t.flags & ts.TypeFlags.StringLiteral) return { const: t.value };
    if (t.flags & ts.TypeFlags.NumberLiteral) return { const: t.value };
    if (t.flags & ts.TypeFlags.BooleanLiteral) return { type: "boolean" };
    if (t.flags & (ts.TypeFlags.String | ts.TypeFlags.TemplateLiteral)) return { type: "string" };
    if (t.flags & ts.TypeFlags.Number) return { type: "number" };
    if (t.flags & ts.TypeFlags.Boolean) return { type: "boolean" };
    if (t.flags & ts.TypeFlags.Null) return { type: "null" };
    if (t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void | ts.TypeFlags.Never)) return null;
    // A recursive alias (a JSON value type) is "any JSON" from its second visit.
    if (t.aliasSymbol) {
      if (seen.has(t.aliasSymbol)) return {};
      seen = new Set(seen).add(t.aliasSymbol);
    }
    if (t.isUnion()) {
      const parts = t.types.filter((m) => !(m.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)));
      const strings = parts.filter((m) => m.flags & ts.TypeFlags.StringLiteral);
      const numbers = parts.filter((m) => m.flags & ts.TypeFlags.NumberLiteral);
      const bools = parts.filter((m) => m.flags & ts.TypeFlags.BooleanLiteral);
      const rest = parts.filter((m) => !(m.flags & (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.BooleanLiteral)));
      const out = [];
      const plainString = rest.some((m) => m.flags & ts.TypeFlags.String);
      if (strings.length && !plainString) out.push({ enum: strings.map((m) => m.value) });
      if (numbers.length) out.push({ enum: numbers.map((m) => m.value) });
      if (bools.length) out.push({ type: "boolean" });
      for (const m of rest) {
        const s = toSchema(m, depth, seen);
        if (s !== null && !out.some((o) => JSON.stringify(o) === JSON.stringify(s))) out.push(s);
      }
      if (out.length === 0) return null;
      if (out.some((o) => Object.keys(o).length === 0)) return {};
      return out.length === 1 ? out[0] : { anyOf: out };
    }
    // `string & {}` (an open string union's trick) is a string.
    if (t.isIntersection() && t.types.some((m) => m.flags & ts.TypeFlags.String)) return { type: "string" };
    if (t.isIntersection()) return objectSchema(t, depth, seen);
    if (isNonData(t)) return null;
    if (checker.isTupleType(t)) {
      const items = checker.getTypeArguments(t).map((a) => toSchema(a, depth + 1, seen));
      if (items.some((s) => s === null)) return null;
      return { type: "array", prefixItems: items, minItems: items.length, maxItems: items.length };
    }
    if (checker.isArrayType(t) || checker.isArrayLikeType?.(t) && t.getSymbol()?.getName() === "ReadonlyArray") {
      const [arg] = checker.getTypeArguments(t);
      const items = arg ? toSchema(arg, depth + 1, seen) : {};
      if (items === null) return null;
      return { type: "array", items };
    }
    if (t.flags & ts.TypeFlags.Object) return objectSchema(t, depth, seen);
    return null;
  }

  function objectSchema(t, depth, seen) {
    if (isNonData(t)) return null;
    if (depth >= DEPTH || seen.has(t)) return { type: "object" };
    const next = new Set(seen).add(t);
    const out = { type: "object" };
    const index = checker.getIndexInfosOfType(t).find((i) => i.keyType.flags & (ts.TypeFlags.String | ts.TypeFlags.TemplateLiteral));
    const props = {};
    const required = [];
    for (const p of checker.getPropertiesOfType(t)) {
      const name = p.getName();
      // Inside data, `id` and `children` are data (a tree node's); only looks and markup are dropped.
      if (NESTED_DENY.has(name) || /^on[A-Z]/.test(name)) continue;
      const pt = checker.getTypeOfSymbol(p);
      const s = labelsOr(name, toSchema(pt, depth + 1, next));
      if (s === null) continue;
      props[name] = s;
      if (!(p.flags & ts.TypeFlags.Optional) && !(p.flags & ts.SymbolFlags.Optional)) required.push(name);
    }
    if (Object.keys(props).length) out.properties = props;
    if (required.length) out.required = required;
    if (index) {
      const v = toSchema(index.type, depth + 1, next);
      if (v !== null) out.additionalProperties = v;
    }
    if (!out.properties && !out.additionalProperties && checker.getPropertiesOfType(t).length > 0) return null;
    return out;
  }

  function propsTypeOf(c) {
    const sym = moduleSymbols.get(c.module);
    if (!sym) throw new Error(`[kit] ${c.type}: module ${c.module} did not resolve.`);
    const [head, ...path] = c.export.split(".");
    let target = checker.getExportsOfModule(sym).find((e) => e.getName() === head);
    if (!target) throw new Error(`[kit] ${c.type}: ${c.module} has no export ${head}.`);
    if (target.flags & ts.SymbolFlags.Alias) target = checker.getAliasedSymbol(target);
    let t = checker.getTypeOfSymbol(target);
    for (const seg of path) {
      const m = checker.getPropertyOfType(t, seg);
      if (!m) throw new Error(`[kit] ${c.type}: ${c.export} not found.`);
      t = checker.getTypeOfSymbol(m);
    }
    for (const sig of t.getCallSignatures()) {
      if (sig.parameters.length >= 1) return checker.getTypeOfSymbol(sig.parameters[0]);
    }
    throw new Error(`[kit] ${c.type}: ${c.export} is not a component.`);
  }

  const bindable = (s) => ({ anyOf: [s, { $ref: "#/$defs/Binding" }] });

  const types = {};
  for (const c of placeable) {
    const properties = {};
    const required = [];
    if (c.derive !== false) {
      const pt = propsTypeOf(c);
      const omit = new Set(c.omit ?? []);
      for (const p of checker.getPropertiesOfType(pt)) {
        const name = p.getName();
        if (DENY.has(name) || omit.has(name) || /^on[A-Z]/.test(name)) continue;
        if (c.state && name !== c.state.value && Object.values(c.state).includes(name)) continue;
        const decl = p.declarations?.[0];
        if (decl && /[\\/]@types[\\/]react[\\/]/.test(decl.getSourceFile().fileName)) continue;
        const s = labelsOr(name, toSchema(checker.getTypeOfSymbol(p), 1, new Set()));
        if (s === null) continue;
        const doc = c.state && name === c.state.value ? "initial value; the island keeps it as state, so it changes as the visitor uses it" : docOf(p);
        properties[name] = bindable(doc ? { ...s, description: doc } : s);
        const optional = (p.flags & ts.SymbolFlags.Optional) !== 0;
        if (!optional) required.push(name);
      }
    }
    if (c.children === "text") properties.text = { $ref: "#/$defs/Text", description: "the component's text content" };
    for (const [k, v] of Object.entries(c.content ?? {})) properties[k] = JSON.stringify(v).includes("#/$defs/") ? v : bindable(v);
    for (const r of c.required ?? []) if (!required.includes(r)) required.push(r);
    for (const r of c.notRequired ?? []) {
      const i = required.indexOf(r);
      if (i >= 0) required.splice(i, 1);
    }
    const props = { type: "object", properties };
    if (required.length) props.required = required;
    const d = { description: c.description, hydrate: "lazy", props };
    const example = c.example ?? examples[c.type];
    if (example) d.example = example;
    d.package = `@particle-academy/${c.type.split(":")[0]}`;
    if (c.children === "slot") d.slot = "children";
    if (c.fallback?.length) d.textFallback = c.fallback;
    types[c.type] = d;
  }

  return {
    $schema: builtin.$schema,
    $defs: { Binding: builtin.$defs.Binding, Text: builtin.$defs.Text },
    types,
  };
}

/** One island type per line, so a regenerated catalogue diffs by type. */
export function serialise(catalogue) {
  const types = Object.entries(catalogue.types).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return `{\n "$schema": ${JSON.stringify(catalogue.$schema)},\n "$defs": ${JSON.stringify(catalogue.$defs)},\n "types": {\n${types.join(",\n")}\n }\n}\n`;
}

/** island type -> its adapter family (one chunk per family): src/kit/families.json. */
export function families() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const out = {};
  for (const c of manifest.components.filter((c) => PLACEABLE.has(c.class))) out[c.type] = c.family;
  return `${JSON.stringify(out, null, 1)}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputs = [[OUT, serialise(generate())], [FAMILIES, families()]];
  if (process.argv.includes("--check")) {
    let stale = false;
    for (const [file, text] of outputs) {
      let current = "";
      try {
        current = readFileSync(file, "utf8");
      } catch {}
      if (current === text) continue;
      stale = true;
      if (file === OUT) {
        const was = current ? JSON.parse(current).types : {};
        const now = JSON.parse(text).types;
        const changed = [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((k) => JSON.stringify(was[k]) !== JSON.stringify(now[k]));
        console.error(`[kit] src/kit/catalogue.json is stale for: ${changed.join(", ") || "(ordering)"}. A component's props changed: run npm run kit:generate.`);
      } else {
        console.error(`[kit] ${file} is stale: run npm run kit:generate.`);
      }
    }
    if (stale) process.exit(1);
    console.log(`[kit] catalogue current: ${Object.keys(JSON.parse(outputs[0][1]).types).length} island types.`);
  } else {
    for (const [file, text] of outputs) writeFileSync(file, text);
    console.log(`[kit] wrote src/kit/catalogue.json: ${Object.keys(JSON.parse(outputs[0][1]).types).length} island types.`);
  }
}
