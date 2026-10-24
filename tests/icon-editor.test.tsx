// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { emptyDoc } from "../src/document/types";
import { ADD_MENU, buildInsertOp } from "../src/editor/insert";
import { Inspector } from "../src/editor/Inspector";
import { NodeInspector } from "../src/editor/NodeInspector";
import { iconNames } from "../src/document/icons";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("human icon authoring", () => {
  it("offers a safe decorative icon through the existing insertion spine", () => {
    const item = ADD_MENU.find((entry) => entry.kind === ("icon" as string));
    expect(item).toBeDefined();
    const { op } = buildInsertOp(emptyDoc("p"), item!.kind, null);
    expect(op).toMatchObject({ t: "insert_node", node: { type: "icon", props: { name: "check", decorative: true } } });
  });
  it("both inspectors expose closed choices and explicit accessible labels through controlled ops", () => {
    const doc = emptyDoc("p");
    doc.nodes.icon = { id: "icon", type: "icon", parent: null, order: "V", props: { name: "receipt-text", decorative: true, label: "" }, style: { base: {} } };
    for (const mode of ["standalone", "inline"]) {
      const host = document.createElement("div"), root = createRoot(host), change = vi.fn();
      act(() => root.render(mode === "standalone"
        ? <Inspector doc={doc} selection="icon" apply={change} />
        : <NodeInspector node={doc.nodes.icon!} transform={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }} measured={{ w: 24, h: 24 }} onProps={change} onStyle={vi.fn()} onTransform={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} />));
      const select = host.querySelector<HTMLSelectElement>('[data-cms-field="icon-name"]');
      expect(select).not.toBeNull();
      expect([...select!.options].map((option) => option.value)).toEqual(iconNames());
      expect(host.querySelector<HTMLInputElement>('[data-cms-field="icon-label"]')).not.toBeNull();
      const decorative = host.querySelector<HTMLInputElement>('[data-cms-field="icon-decorative"]');
      expect(decorative!.checked).toBe(true);
      expect(decorative!.disabled).toBe(true);
      act(() => { select!.value = "calculator"; select!.dispatchEvent(new Event("change", { bubbles: true })); });
      expect(change).toHaveBeenCalledWith(mode === "standalone" ? { t: "set_node_props", id: "icon", patch: { name: "calculator" } } : { name: "calculator" });
      for (const label of host.querySelectorAll<HTMLLabelElement>("label[for]")) expect(label.control).not.toBeNull();
      act(() => root.unmount());
    }
  });
});
