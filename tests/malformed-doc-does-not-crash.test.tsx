// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { emitDocCss } from "../src/render/css";
import { rootIds } from "../src/document/reduce";
import { CmsPage } from "../src/react/CmsPage";
import { emptyDoc, type PageDoc } from "../src/document/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(el: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return { host, unmount: () => act(() => root.unmount()) };
}

/**
 * A malformed document must render as EMPTY, never throw.
 *
 * Reported by a consumer, reproduced here before fixing. `emitDocCss` did
 * `Object.keys(doc.nodes)`, which throws `TypeError: Cannot convert undefined
 * or null to object` DURING RENDER — and a throw during render unmounts the
 * host's whole React subtree, not just this page.
 *
 * That is why it cost a whole surface rather than one component: the consumer
 * renders an authored page inside the same modal a person uses to answer a
 * paused workflow step, so the fields, the confirm button and the dismiss all
 * went with it. From outside it looked like nothing happened at all — the
 * report was "the user input nodes still don't open for me".
 *
 * The document was malformed because an authoring agent wrote a markdown
 * STRING where a node map belongs. A person cannot produce that: the field
 * renders a canvas. Only config written directly can, which is why tolerating
 * it is the renderer's job rather than the author's.
 *
 * Note the editor half was already defensive about the identical shape —
 * `DocumentField`'s `countNodes` handles array / object / absent. **The editor
 * tolerated what the renderer died on**, so nothing in one half's testing could
 * see the other's gap.
 */
const MALFORMED: Array<[string, unknown]> = [
  ["null", null],
  ["undefined", undefined],
  ["an array", []],
  ["an object with no nodes", { meta: { title: "Welcome" } }],
  ["a markdown string, which is what the agent wrote", "## Welcome\n\nThis is your guided tour."],
  ["nodes set to null", { nodes: null }],
];

describe("a malformed document renders empty instead of taking down its host", () => {
  it.each(MALFORMED)("CmsPage survives %s", (_label, doc) => {
    const { host, unmount } = mount(<CmsPage doc={doc as PageDoc} />);
    expect(host.isConnected).toBe(true);
    unmount();
  });

  it.each(MALFORMED)("emitDocCss survives %s", (_label, doc) => {
    expect(() => emitDocCss(doc as PageDoc)).not.toThrow();
    expect(emitDocCss(doc as PageDoc)).toBe("");
  });

  it.each(MALFORMED)("rootIds survives %s", (_label, doc) => {
    expect(() => rootIds(doc as PageDoc)).not.toThrow();
    expect(rootIds(doc as PageDoc)).toEqual([]);
  });

  it("still renders a well-formed document, so the guard is not a mute button", () => {
    const doc: PageDoc = {
      ...emptyDoc("d1"),
      nodes: {
        a: { id: "a", type: "text", parent: null, order: "a0", props: { content: "HELLO" }, style: { base: {} } },
      },
    };

    const { host, unmount } = mount(<CmsPage doc={doc} includeStyles={false} />);
    expect(host.textContent).toContain("HELLO");
    unmount();
  });

  it("an EMPTY node map was always fine and must stay fine", () => {
    expect(emitDocCss({ nodes: {} } as PageDoc)).toBe("");
    expect(rootIds({ nodes: {} } as PageDoc)).toEqual([]);
  });
});
