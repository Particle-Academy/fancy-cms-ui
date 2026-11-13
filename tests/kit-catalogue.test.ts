/**
 * The kit island catalogue (src/kit): every kit component a page may place,
 * with its props schema generated from the component's real types.
 *
 * The drift test is the first one: it re-runs the generator against the
 * installed packages and fails when src/kit/catalogue.json no longer matches,
 * i.e. when a component's props changed and its schema did not.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validate } from "./support/json-schema";
import { KIT_FAMILIES, KIT_ISLAND_CATALOGUE } from "../src/kit";
import { descriptorJson } from "../src/islands/catalogue";

const root = resolve(__dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "src/kit/manifest.json"), "utf8")) as { components: Record<string, unknown>[] };
const families = JSON.parse(readFileSync(resolve(root, "src/kit/families.json"), "utf8")) as Record<string, string>;
const types = KIT_ISLAND_CATALOGUE.types;
const defs = KIT_ISLAND_CATALOGUE.$defs as Record<string, Record<string, unknown>>;
const PLACEABLE = new Set(["page", "chrome", "data"]);

describe("drift", () => {
  it("src/kit/catalogue.json is what the installed components' prop types generate", () => {
    const run = spawnSync(process.execPath, [resolve(root, "scripts/generate-kit-catalogue.mjs"), "--check"], { cwd: root, encoding: "utf8" });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  }, 120000);

  it("the PHP copy is byte-identical when the sibling is checked out", () => {
    const theirs = resolve(root, "../fancy-cms/resources/islands/kit-catalogue.json");
    if (!existsSync(theirs)) return;
    expect(readFileSync(resolve(root, "src/kit/catalogue.json"), "utf8")).toBe(readFileSync(theirs, "utf8"));
  });
});

describe("the manifest (the inventory)", () => {
  it("classifies every row, and every row that is not placeable says why", () => {
    for (const c of manifest.components) {
      expect(["page", "chrome", "data", "builtin", "part", "n/a"]).toContain(c.class);
      if (c.class === "n/a") expect(typeof c.reason === "string" && (c.reason as string).length > 10, `${String(c.export)} needs a reason`).toBe(true);
      if (c.class === "part") expect(typeof c.of, `${String(c.export)} names its parent`).toBe("string");
    }
  });

  it("lists each placeable type once, with a description and a family that has a chunk", () => {
    const rows = manifest.components.filter((c) => PLACEABLE.has(c.class as string));
    const names = rows.map((c) => c.type as string);
    expect(new Set(names).size).toBe(names.length);
    for (const c of rows) {
      expect(typeof c.description).toBe("string");
      expect(Object.keys(KIT_FAMILIES)).toContain(c.family);
    }
    expect(Object.keys(types).sort()).toEqual([...names].sort());
    expect(Object.keys(families).sort()).toEqual([...names].sort());
  });
});

describe("every catalogue entry", () => {
  const entries = Object.entries(types);

  it.each(entries)("%s is a valid lazy island descriptor with a package", (type, d) => {
    expect(() => descriptorJson(type, d)).not.toThrow();
    expect(d.hydrate).toBe("lazy");
    expect(d.package).toMatch(/^@particle-academy\//);
  });

  it.each(entries)("%s offers no function, markup, script or styling prop", (_type, d) => {
    const props = Object.keys((d.props.properties ?? {}) as object);
    for (const bad of ["children", "className", "style", "html", "unsafe", "dangerouslySetInnerHTML", "scriptUrl", "id", "ref"]) expect(props).not.toContain(bad);
    for (const p of props) expect(p).not.toMatch(/^on[A-Z]/);
    expect(JSON.stringify(d.props)).not.toMatch(/"(scriptUrl|dangerouslySetInnerHTML|unsafe)"/);
  });

  it.each(entries)("%s has an example that its schema accepts, using declared props only", (_type, d) => {
    expect(d.example).toBeDefined();
    expect(validate(d.example, d.props, defs)).toEqual([]);
    for (const k of Object.keys(d.example!)) expect(Object.keys((d.props.properties ?? {}) as object)).toContain(k);
  });

  it.each(entries.filter(([, d]) => d.textFallback))("%s text fallback names declared props", (_type, d) => {
    const props = Object.keys((d.props.properties ?? {}) as object);
    for (const step of d.textFallback!) {
      const key = "text" in step ? step.text : "code" in step ? step.code : step.list;
      expect(props).toContain(key);
    }
  });
});

describe("CC-fancy-0035: every chart kind", () => {
  it("react-fancy:Chart offers all eight react-fancy Chart kinds", () => {
    const kind = (types["react-fancy:Chart"]!.props.properties as Record<string, { anyOf: { enum: string[] }[] }>).kind!;
    expect(kind.anyOf[0]!.enum).toEqual(["bar", "horizontal-bar", "stacked-bar", "line", "area", "pie", "donut", "sparkline"]);
  });
});
