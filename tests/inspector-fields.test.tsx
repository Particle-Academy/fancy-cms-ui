// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { emptyDoc, type PageDoc } from "../src/document/types";
import { reduce } from "../src/document/reduce";
import { buildInsertOp } from "../src/editor/insert";
import { Inspector } from "../src/editor/Inspector";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(el: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return { host, rerender: (next: ReactElement) => act(() => root.render(next)) };
}

afterEach(() => {
  document.body.innerHTML = "";
});

/** A doc with one text node selected, which is what the inspector edits. */
function docWithText(): { doc: PageDoc; id: string } {
  const base = emptyDoc("t");
  const { op, id } = buildInsertOp(base, "text", null);
  return { doc: reduce(base, op), id };
}

/**
 * The inspector's labels are attached to their controls, and addressable.
 *
 * They were not. Unlike `NodeInspector`, whose labels WRAP their inputs and are
 * therefore implicitly associated, every label in this file was a plain sibling
 * — `<label>Background</label><input/>` — so clicking one focused nothing and a
 * screen reader announced the panel as a column of unlabelled boxes.
 *
 * `data-cms-field` is the Human+ handle: the contract asks that an agent address
 * an element by name rather than guessing at the DOM, and nothing here had one.
 */
describe("Inspector fields", () => {
  const labelled = (host: HTMLElement, text: string) => {
    const label = [...host.querySelectorAll("label")].find((l) => l.textContent === text);
    if (!label?.htmlFor) return null;
    // getElementById, not a `#id` selector: useId produces ids containing `:`,
    // which is invalid in a CSS selector, and this jsdom has no CSS.escape.
    return document.getElementById(label.htmlFor);
  };

  it.each(["Background", "Text color", "Font size (px)", "Padding (px)", "Opacity"])(
    "attaches the %s label to a real control",
    (text) => {
      const { doc, id } = docWithText();
      const { host } = mount(<Inspector doc={doc} selection={id} apply={vi.fn()} />);

      const control = labelled(host, text);

      expect(control).not.toBeNull();
      expect(["INPUT", "TEXTAREA", "SELECT"]).toContain(control!.tagName);
    },
  );

  it("attaches the type-specific Content field too", () => {
    const { doc, id } = docWithText();
    const { host } = mount(<Inspector doc={doc} selection={id} apply={vi.fn()} />);

    expect(labelled(host, "Content")?.tagName).toBe("TEXTAREA");
  });

  it("gives every control a handle keyed by its field", () => {
    const { doc, id } = docWithText();
    const { host } = mount(<Inspector doc={doc} selection={id} apply={vi.fn()} />);

    const handles = [...host.querySelectorAll("[data-cms-field]")].map((el) =>
      el.getAttribute("data-cms-field"),
    );

    expect(handles).toEqual(
      expect.arrayContaining(["content", "background", "color", "fontSize", "padding", "opacity"]),
    );
  });

  it("does not reuse ids between two inspectors on one page", () => {
    const { doc, id } = docWithText();
    const a = mount(<Inspector doc={doc} selection={id} apply={vi.fn()} />);
    const b = mount(<Inspector doc={doc} selection={id} apply={vi.fn()} />);

    const idOf = (h: HTMLElement) => h.querySelector('[data-cms-field="background"]')?.id;

    expect(idOf(a.host)).toBeTruthy();
    expect(idOf(a.host)).not.toBe(idOf(b.host));
  });

  it("survives selecting, deselecting and reselecting", () => {
    // The hook-order trap. `useId` runs before the `if (!node)` early return —
    // fancy-flow shipped a blank-editor crash (React #310) by getting exactly
    // this wrong in exactly this shape of component.
    const { doc, id } = docWithText();
    const { host, rerender } = mount(<Inspector doc={doc} selection={null} apply={vi.fn()} />);

    expect(host.textContent).toContain("Select an element");

    rerender(<Inspector doc={doc} selection={id} apply={vi.fn()} />);
    expect(host.querySelector('[data-cms-field="background"]')).not.toBeNull();

    rerender(<Inspector doc={doc} selection={null} apply={vi.fn()} />);
    expect(host.textContent).toContain("Select an element");
  });
});

/**
 * Chrome colours resolve from the `--fcms-*` layer.
 *
 * The editor ships a light/dark token system and then hardcoded a slate palette
 * in the overlay and the inspector, so a light-themed host got a permanently
 * dark element palette. Tokens carry the previous values as fallbacks, so the
 * default rendering is unchanged and only a theming host sees a difference.
 */
describe("theming", () => {
  it("routes the element palette through tokens rather than fixed hex", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("src/editor/EditablePage.tsx", "utf8");

    expect(source).toContain("var(--fcms-bg,");
    expect(source).toContain("var(--fcms-border,");
    expect(source).toContain("var(--fcms-accent,");
    // The panel background was the worst of them: dark inside a light host.
    expect(source).not.toMatch(/background: "#0b1220"/);
  });

  it("defines every token it references", async () => {
    const fs = await import("node:fs");
    const read = (f: string) => fs.readFileSync(`src/editor/${f}`, "utf8");
    const editor = read("Editor.tsx");

    const referenced = new Set<string>();
    for (const file of ["Editor.tsx", "EditablePage.tsx", "NodeInspector.tsx", "Inspector.tsx", "Canvas.tsx", "LayersPanel.tsx"]) {
      for (const m of read(file).matchAll(/var\((--fcms-[a-z-]+)/g)) referenced.add(m[1]);
    }

    // A token nobody defines silently falls back per-usage, so a host that
    // themes the editor finds one panel stubbornly unchanged.
    const undefined_ = [...referenced].filter((t) => !editor.includes(`${t}:`));
    expect(undefined_).toEqual([]);
  });
});
