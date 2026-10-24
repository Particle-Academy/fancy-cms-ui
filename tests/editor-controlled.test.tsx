// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Editor } from "../src/editor/Editor";
import { emptyDoc, type PageDoc } from "../src/document/types";
import { reduce } from "../src/document/reduce";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function doc(content: string): PageDoc {
  return reduce(emptyDoc("shared"), { t: "insert_node", node: {
    id: "text", type: "text", parent: null, order: "a", props: { content }, style: { base: {} },
  } });
}
function typeInto(element: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("controlled Editor", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  async function select() {
    await act(async () => container.querySelector('[data-cms="text"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  }

  it("renders incoming server state without echoing it, preserving the selected handle", async () => {
    const onChange = vi.fn(); const onOp = vi.fn();
    await act(async () => root.render(<StrictMode><Editor value={doc("First")} onChange={onChange} onOp={onOp} /></StrictMode>));
    await select();
    expect(container.querySelector("textarea")!.value).toBe("First");
    await act(async () => root.render(<StrictMode><Editor value={doc("Server edit")} onChange={onChange} onOp={onOp} /></StrictMode>));
    expect(container.querySelector("textarea")!.value).toBe("Server edit");
    expect(onChange).not.toHaveBeenCalled(); expect(onOp).not.toHaveBeenCalled();
  });

  it("emits one native operation and proposed document without taking ownership of value", async () => {
    const onChange = vi.fn(); const onOp = vi.fn(); const value = doc("Server");
    await act(async () => root.render(<Editor value={value} onChange={onChange} onOp={onOp} />));
    await select(); await act(async () => typeInto(container.querySelector("textarea")!, "Human proposal"));
    expect(onOp).toHaveBeenCalledExactlyOnceWith({ t: "set_node_props", id: "text", patch: { content: "Human proposal" } });
    expect(onChange).toHaveBeenCalledOnce(); expect(onChange.mock.calls[0]![0].nodes.text.props.content).toBe("Human proposal");
    expect(container.querySelector("textarea")!.value).toBe("Server");
    expect(value.nodes.text!.props.content).toBe("Server");
    const accepted = reduce(value, onOp.mock.calls[0]![0]);
    await act(async () => root.render(<Editor value={accepted} onChange={onChange} onOp={onOp} />));
    expect(container.querySelector("textarea")!.value).toBe("Human proposal");
    expect(onOp).toHaveBeenCalledOnce(); expect(onChange).toHaveBeenCalledOnce();
  });

  it("supports an operation-only server host and disables local snapshot undo", async () => {
    const onOp = vi.fn();
    await act(async () => root.render(<Editor value={doc("Server")} onOp={onOp} />));
    await select(); await act(async () => typeInto(container.querySelector("textarea")!, "Human"));
    expect(onOp).toHaveBeenCalledOnce();
    const history = [...container.querySelectorAll("button")].filter((button) => ["Undo", "Redo"].includes(button.textContent ?? ""));
    expect(history).toHaveLength(2); expect(history.every((button) => button.disabled)).toBe(true);
  });

  it("does not notify on uncontrolled StrictMode mount", async () => {
    const onChange = vi.fn();
    await act(async () => root.render(<StrictMode><Editor defaultValue={doc("Local")} onChange={onChange} /></StrictMode>));
    expect(onChange).not.toHaveBeenCalled();
    await select(); await act(async () => typeInto(container.querySelector("textarea")!, "Edited"));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("blocks document edits while disabled, including programmatically dispatched input", async () => {
    const onChange = vi.fn(); const onOp = vi.fn();
    await act(async () => root.render(<Editor defaultValue={doc("Local")} disabled onChange={onChange} onOp={onOp} />));
    await select(); await act(async () => typeInto(container.querySelector("textarea")!, "Should not apply"));
    expect(container.querySelector("fieldset")?.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled(); expect(onOp).not.toHaveBeenCalled();
    expect(container.querySelector("textarea")!.value).toBe("Local");
  });
});
