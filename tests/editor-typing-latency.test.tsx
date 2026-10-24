// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Editor } from "../src/editor/Editor";
import { emptyDoc, type PageDoc } from "../src/document/types";
import type { PageOp } from "../src/document/ops";
import { reduce } from "../src/document/reduce";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function seed(): PageDoc {
  return reduce(emptyDoc("typing"), { t: "insert_node", node: {
    id: "text", type: "text", parent: null, order: "a", props: { content: "Body copy" }, style: { base: {} },
  } });
}

describe("controlled Editor under server latency", () => {
  let container: HTMLDivElement; let root: Root; let server: PageDoc; let ops: PageOp[];
  let remote: (content: string) => void;
  let remoteOp: (op: PageOp) => void;
  let reject: boolean;
  beforeEach(() => {
    vi.useFakeTimers(); server = seed(); ops = []; reject = false;
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

  async function mount(disablePending: boolean) {
    function Host() {
      const [doc, setDoc] = useState(seed); const [pending, setPending] = useState(false);
      remoteOp = (op) => setDoc((current) => { server = reduce(current, op); return server; });
      remote = (content) => remoteOp({ t: "set_node_props", id: "text", patch: { content } });
      const onOp = (op: PageOp) => {
        ops.push(op); setPending(true);
        setTimeout(() => { if (!reject) setDoc((current) => { server = reduce(current, op); return server; }); setPending(false); }, 400);
      };
      return <Editor value={doc} onOp={onOp} disabled={disablePending && pending} />;
    }
    await act(async () => root.render(<StrictMode><Host /></StrictMode>));
    await act(async () => container.querySelector('[data-cms="text"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await act(async () => container.querySelector("textarea")!.focus());
  }
  const field = () => container.querySelector("textarea")!;
  const content = () => server.nodes.text!.props.content;
  async function tick(ms: number) { await act(async () => vi.advanceTimersByTime(ms)); }
  async function type(text: string) {
    for (const character of text) {
      await act(async () => {
        const target = field();
        if (!target.matches(":disabled")) {
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(target, target.value + character);
          target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: character }));
        }
      });
      await tick(60);
    }
  }

  for (const disablePending of [true, false]) {
    it(`keeps every typed character with host disabled=${disablePending}`, async () => {
      await mount(disablePending);
      await type("XYZ");
      expect(field().value).toBe("Body copyXYZ");
      await tick(300);
      expect(field().matches(":disabled")).toBe(false);
      expect(field().value).toBe("Body copyXYZ");
      await tick(400);
      expect(content()).toBe("Body copyXYZ"); expect(field().value).toBe("Body copyXYZ");
    });
    it(`buffers more typing during a pending commit with host disabled=${disablePending}`, async () => {
      await mount(disablePending); await type("X"); await tick(300);
      expect(ops).toHaveLength(1);
      await type("YZ"); expect(field().value).toBe("Body copyXYZ");
      await tick(400); await tick(400);
      expect(content()).toBe("Body copyXYZ"); expect(field().value).toBe("Body copyXYZ");
      expect(ops).toHaveLength(2);
    });
  }

  it("flushes on blur and preserves a conflicting local draft until an explicit decision", async () => {
    await mount(true); await type("X");
    await act(async () => remote("Remote title"));
    expect(field().value).toBe("Body copyX");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("changed");
    await tick(1000); expect(ops).toHaveLength(0);
    const keep = [...container.querySelectorAll("button")].find((button) => button.textContent === "Keep draft")!;
    await act(async () => keep.click()); await tick(400);
    expect(content()).toBe("Body copyX");
    await type("Y"); await act(async () => field().blur());
    expect(ops).toHaveLength(2); await tick(400); expect(content()).toBe("Body copyXY");
  });

  it("does not commit partially composed IME text", async () => {
    await mount(false);
    await act(async () => field().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    await type("漢"); await tick(500); expect(ops).toHaveLength(0);
    await act(async () => field().dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
    await tick(300); await tick(400); expect(content()).toBe("Body copy漢");
  });

  it("updates unrelated fields while protecting the drafted field", async () => {
    await mount(false); await type("X");
    await act(async () => remoteOp({ t: "set_style", id: "text", breakpoint: "base", patch: { color: "red" } }));
    expect(field().value).toBe("Body copyX");
    expect((container.querySelector('[data-cms-field="color"]') as HTMLInputElement).value).toBe("red");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await tick(300); await tick(400); expect(content()).toBe("Body copyX");
  });

  it("retains text after node removal and offers explicit discard without recreating the node", async () => {
    await mount(false); await type("XYZ");
    await act(async () => remoteOp({ t: "remove_node", id: "text" }));
    expect(container.querySelector('[data-cms-retained-draft]')?.textContent).toBe("Body copyXYZ");
    const keep = [...container.querySelectorAll("button")].find((button) => button.textContent === "Keep draft")!;
    expect(keep.disabled).toBe(true);
    await tick(1000); expect(ops).toHaveLength(0);
    const discard = [...container.querySelectorAll("button")].find((button) => button.textContent === "Use server value")!;
    await act(async () => discard.click());
    expect(container.querySelector('[role="alert"]')).toBeNull(); expect(server.nodes.text).toBeUndefined();
  });

  it("surfaces rejection when pending clears without accepting the committed field", async () => {
    await mount(true); reject = true; await type("X"); await tick(300); await tick(400);
    expect(field().value).toBe("Body copyX"); expect(content()).toBe("Body copy");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("not accepted");
    await tick(2000); expect(ops).toHaveLength(1);
  });

  it("retains an unacknowledged draft and never automatically retries it", async () => {
    await mount(false); reject = true; await type("X"); await tick(300); await tick(10000);
    expect(field().value).toBe("Body copyX");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("not been acknowledged");
    expect(ops).toHaveLength(1);
    const discard = [...container.querySelectorAll("button")].find((button) => button.textContent === "Use server value")!;
    await act(async () => discard.click()); expect(field().value).toBe("Body copy");
  });

  it("serializes buffered fields across a selection change without losing either draft", async () => {
    await mount(false);
    await act(async () => remoteOp({ t: "insert_node", node: {
      id: "other", type: "text", parent: null, order: "b", props: { content: "Other" }, style: { base: {} },
    } }));
    await type("X"); await act(async () => field().blur());
    expect(ops).toHaveLength(1);
    await act(async () => container.querySelector('[data-cms="other"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await act(async () => field().focus()); await type("Y"); expect(field().value).toBe("OtherY");
    expect(ops).toHaveLength(1);
    await tick(400); await tick(400);
    expect(content()).toBe("Body copyX"); expect(server.nodes.other!.props.content).toBe("OtherY");
    expect(ops).toHaveLength(2);
  });

  it("surfaces a later same-field remote change while the acknowledged field remains focused", async () => {
    await mount(false); await type("X"); await tick(300); await tick(400);
    expect(content()).toBe("Body copyX");
    await act(async () => remote("Later remote"));
    expect(field().value).toBe("Body copyX"); expect(content()).toBe("Later remote");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("changed");
    expect(ops).toHaveLength(1);
  });
});
