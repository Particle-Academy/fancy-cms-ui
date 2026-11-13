// @vitest-environment jsdom
/** A kit island wider than its frame scrolls inside a labelled, focusable region instead of widening the page. */
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { CmsPage } from "../src/react/CmsPage";
import { defaultIslands, registerIslands } from "../src/react/islands";
import { kitIslands } from "../src/kit";
import type { PageDoc } from "../src/document/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const islands = registerIslands(defaultIslands, kitIslands);
const doc = {
  id: "f",
  seq: 0,
  meta: { title: "F", slug: "/", scrollMode: "smooth" },
  theme: { name: "default" },
  breakpoints: ["base", "md", "lg"],
  nodes: { b: { id: "b", type: "react-fancy:Badge", parent: null, order: "a0", props: { text: "Wide" }, style: { base: {} } } },
} as unknown as PageDoc;

const proto = HTMLElement.prototype;
const original = { sw: Object.getOwnPropertyDescriptor(proto, "scrollWidth"), cw: Object.getOwnPropertyDescriptor(proto, "clientWidth") };
afterEach(() => {
  if (original.sw) Object.defineProperty(proto, "scrollWidth", original.sw);
  if (original.cw) Object.defineProperty(proto, "clientWidth", original.cw);
});

async function mount(): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => createRoot(host).render(<CmsPage doc={doc} islands={islands} includeStyles={false} />));
  for (let i = 0; i < 40 && !host.querySelector("[data-kit-island]"); i++) await act(async () => new Promise((r) => setTimeout(r, 25)));
  return host;
}

describe("KitFrame", () => {
  it("becomes a labelled, focusable scroll region when its content is wider than it", async () => {
    Object.defineProperty(proto, "scrollWidth", { configurable: true, get: () => 600 });
    Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => 300 });
    const frame = (await mount()).querySelector("[data-kit-island]")!;
    expect(frame.getAttribute("role")).toBe("region");
    expect(frame.getAttribute("tabindex")).toBe("0");
    expect(frame.getAttribute("aria-label")).toBe("A small status or count badge");
    expect((frame as HTMLElement).style.overflowX).toBe("auto");
  });

  it("adds nothing to a component that fits", async () => {
    Object.defineProperty(proto, "scrollWidth", { configurable: true, get: () => 300 });
    Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => 300 });
    const frame = (await mount()).querySelector("[data-kit-island]")!;
    expect(frame.hasAttribute("role")).toBe(false);
    expect(frame.hasAttribute("tabindex")).toBe(false);
  });
});
