// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { emptyDoc, type Node, type PageDoc } from "../src/document/types";
import { reduce } from "../src/document/reduce";
import { Editor } from "../src/editor/Editor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mkNode(id: string, parent: string | null, order: string, extra: Partial<Node> = {}): Node {
  return {
    id,
    type: extra.type ?? "section",
    parent,
    order,
    props: extra.props ?? {},
    style: extra.style ?? { base: {} },
    ...extra,
  };
}

function build(): PageDoc {
  let doc = emptyDoc("p1");
  doc = reduce(doc, { t: "insert_node", node: mkNode("s1", null, "a") });
  doc = reduce(doc, {
    t: "insert_node",
    node: mkNode("t1", "s1", "a", { type: "text", props: { content: "Hello" } }),
  });
  return doc;
}

/**
 * Regression harness for #1: the most natural consumer — an INLINE closure that
 * also sets state. Every notify re-renders the consumer with a fresh state
 * object, minting a NEW closure identity for `onChange`. Before the fix, the
 * Editor's notify effect depended on that identity, so each notify re-fired the
 * effect: notify → setState → render → new closure → notify → … (91k fires
 * observed for one op). With `onChange` held in a ref, the effect depends only
 * on the doc and each op notifies exactly once.
 */
function InlineClosureConsumer({
  doc,
  log,
}: {
  doc: PageDoc;
  log: { notifies: number; last: PageDoc | null };
}): ReactElement {
  const [, setSnapshot] = useState<{ doc: PageDoc } | null>(null);
  return (
    <Editor
      defaultValue={doc}
      onChange={(d) => {
        log.notifies += 1;
        log.last = d;
        // New object every time → guaranteed re-render + fresh closure identity.
        // Capped so a regression fails the `toBe(1)` assertion instead of hanging
        // the suite in an unbounded notify → setState → render microtask loop.
        if (log.notifies <= 5) setSnapshot({ doc: d });
      }}
    />
  );
}

/** Set a controlled field's value natively (bypassing React's value tracker) and fire `input`. */
function typeInto(el: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Editor onChange notify (#1)", () => {
  it("notifies exactly once per op for an inline-closure consumer that sets state", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const log = { notifies: 0, last: null as PageDoc | null };

    await act(async () => {
      root.render(<InlineClosureConsumer doc={build()} log={log} />);
    });
    expect(log.notifies).toBe(0); // mount never notifies

    // Select the text node on the canvas — selection is not a doc change.
    await act(async () => {
      container.querySelector('[data-cms="t1"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(log.notifies).toBe(0);

    // Op 1: edit the text content through the Inspector.
    const textarea = container.querySelector("textarea")!;
    await act(async () => {
      typeInto(textarea, "Hello, world");
    });
    expect(log.notifies).toBe(1);
    expect(log.last?.nodes["t1"]?.props.content).toBe("Hello, world");

    // The notify's setState re-rendered with a NEW closure identity — flush an
    // idle pass and confirm the notify effect did not re-fire.
    await act(async () => {});
    expect(log.notifies).toBe(1);

    // Op 2: still exactly one notify per op.
    await act(async () => {
      typeInto(container.querySelector("textarea")!, "Hello, again");
    });
    expect(log.notifies).toBe(2);
    expect(log.last?.nodes["t1"]?.props.content).toBe("Hello, again");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
