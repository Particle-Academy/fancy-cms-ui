// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { emptyDoc, type Node } from "../src/document/types";
import { rootIds } from "../src/document/reduce";
import type { LegacyPageDoc } from "../src/document/migrate";
import { initEditor } from "../src/editor/state";
import { CmsPage } from "../src/react/CmsPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(el: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return { host, unmount: () => act(() => root.unmount()) };
}

function mkNode(id: string, order: string): Node {
  return {
    id,
    type: "text",
    parent: null,
    order,
    props: { content: id.toUpperCase() },
    style: {},
  };
}

/**
 * A page the user dragged into c, a, b — stored with order keys that still read
 * a, b, c. The array is the only surviving record of the real order, which is
 * why both entry points have to migrate rather than trust the keys.
 */
function reorderedLegacyDoc(): LegacyPageDoc {
  const doc = emptyDoc("p1") as LegacyPageDoc;
  doc.sections = ["c", "a", "b"];
  doc.nodes = {
    a: mkNode("a", "a0"),
    b: mkNode("b", "a1"),
    c: mkNode("c", "a2"),
  };
  return doc;
}

describe("legacy documents are migrated at the entry points", () => {
  it("initEditor migrates on the way in", () => {
    expect(rootIds(initEditor(reorderedLegacyDoc()).doc)).toEqual(["c", "a", "b"]);
  });

  it("CmsPage renders the reordered order, not the stale key order", () => {
    const { host, unmount } = mount(<CmsPage doc={reorderedLegacyDoc()} includeStyles={false} />);

    // Read the rendered text in document order — the actual user-visible
    // outcome, rather than an assertion about the model.
    const text = (host.textContent ?? "").replace(/\s+/g, "");

    expect(text).toBe("CAB");
    unmount();
  });

  it("still renders an already-migrated document", () => {
    const doc = {
      ...emptyDoc("p1"),
      nodes: { a: mkNode("a", "a0"), b: mkNode("b", "a1") },
    };
    const { host, unmount } = mount(<CmsPage doc={doc} includeStyles={false} />);

    expect((host.textContent ?? "").replace(/\s+/g, "")).toBe("AB");
    unmount();
  });
});
