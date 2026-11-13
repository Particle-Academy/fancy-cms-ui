// @vitest-environment jsdom
/**
 * Every kit island renders its catalogue example: through CmsPage, with the
 * kit registry, its family chunk loaded and the component mounted, with no
 * console error and no render error swallowed by the island boundary.
 *
 * jsdom cannot run WebGL or a terminal, and some families need a third-party
 * peer this package does not install (the third-party rule). Those families are
 * named in UNLOADABLE with the reason; the test fails if the list is wrong in
 * either direction, so a family cannot quietly stop loading. The lab's
 * kit-catalogue brief renders every one of them in a real browser.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { CmsPage } from "../src/react/CmsPage";
import { defaultIslands, registerIslands } from "../src/react/islands";
import { KIT_FAMILIES, KIT_ISLAND_CATALOGUE, kitIslands } from "../src/kit";
import type { PageDoc } from "../src/document/types";
import families from "../src/kit/families.json";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Families that cannot load in jsdom, and why. Checked in both directions. */
const UNLOADABLE: Record<string, string> = {
  "fancy-3d-three": "three, its peer, is not installed here",
  "fancy-3d-babylon": "@babylonjs/core, its peer, is not installed here",
  "fancy-grid": "@tanstack/react-table, its peer, is not installed here",
  "fancy-passkeys-ui": "@simplewebauthn/browser, its peer, is not installed here",
  classroom: "axios, its peer, is not installed here",
  "job-board": "axios, its peer, is not installed here",
};

/** Families that load but whose component imports a third-party peer when it mounts. */
const PEER_AT_MOUNT: Record<string, string> = {
  "fancy-term": "Terminal imports @xterm/xterm, its peer, on mount; it is not installed here",
};

/**
 * Defects in a kit package that the example exposes, with the console error it
 * produces. Each is a finding against that package; the test fails when the
 * error stops happening, so the entry is removed once the package is fixed.
 */
const KNOWN_DEFECTS: Record<string, string> = {
  "fancy-mlm-ui:ReferralStats": "tfoot", // its totals row renders a react-fancy Table.Row outside the table body, a <div> inside <tfoot> (fancy-mlm-ui 0.4.0)
};

const islands = registerIslands(defaultIslands, kitIslands);
// The host data the examples bind: a builtin captcha config, as particle-academy/fancy-captcha shares it.
const data = {
  captcha: { provider: "builtin", siteKey: null, action: null, fields: { honeypot: "contact_fax", started: "_captcha_started", pow: "_captcha_pow", token: "_captcha_token" }, started: "1763030400", pow: { enabled: false, difficulty: 0, challengeUrl: null }, consentCategory: null, configured: true },
  files: {},
};

function doc(type: string, props: Record<string, unknown>): PageDoc {
  return {
    id: "kit",
    seq: 0,
    meta: { title: "Kit", slug: "/", scrollMode: "smooth" },
    theme: { name: "default" },
    breakpoints: ["base", "md", "lg"],
    nodes: { n: { id: "n", type, parent: null, order: "a0", props: props as never, style: { base: {} } } },
  } as unknown as PageDoc;
}

const loadable = new Map<string, boolean>();
beforeAll(async () => {
  // jsdom gaps the kit's components feel for; real browsers have all of these.
  const g = globalThis as Record<string, unknown>;
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  g.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  g.matchMedia ??= (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false });
  for (const [family, load] of Object.entries(KIT_FAMILIES)) {
    loadable.set(family, await load().then(() => true, () => false));
  }
}, 120000);

describe("family chunks", () => {
  it("load in jsdom except exactly the UNLOADABLE ones", () => {
    const failed = [...loadable].filter(([, ok]) => !ok).map(([f]) => f).sort();
    expect(failed).toEqual(Object.keys(UNLOADABLE).sort());
  });

  it("each loadable chunk has an adapter for every type of its family", async () => {
    for (const [type, family] of Object.entries(families as Record<string, string>)) {
      if (!loadable.get(family)) continue;
      const m = await KIT_FAMILIES[family]!();
      expect(m.islands[type], `${family} has no adapter for ${type}`).toBeTypeOf("function");
    }
  });
});

describe("server render", () => {
  it.each(Object.keys(KIT_ISLAND_CATALOGUE.types))("%s renders its text fallback on the server", (type) => {
    const example = KIT_ISLAND_CATALOGUE.types[type]!.example!;
    const html = renderToString(<CmsPage doc={doc(type, example)} islands={islands} data={data} includeStyles={false} />);
    expect(html).toContain(`data-cms-island="${type}"`);
    expect(html).not.toContain("data-kit-island");
  });
});

describe("browser render", () => {
  const errors: unknown[][] = [];
  let spy: ReturnType<typeof vi.spyOn>;
  beforeAll(() => {
    spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
  });
  afterAll(() => spy.mockRestore());

  const types = Object.entries(families as Record<string, string>).filter(([, f]) => !(f in UNLOADABLE) && !(f in PEER_AT_MOUNT)).map(([t]) => t);
  it.each(types)("%s mounts its component from the example with no console error", async (type) => {
    errors.length = 0;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const example = KIT_ISLAND_CATALOGUE.types[type]!.example!;
    await act(async () => {
      root.render(<CmsPage doc={doc(type, example)} islands={islands} data={data} includeStyles={false} />);
    });
    for (let i = 0; i < 40 && !host.querySelector("[data-cms-island-ready]"); i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 25));
      });
    }
    const ready = host.querySelector(`[data-cms-island-ready="${type}"]`);
    const messages = errors.map((e) => e.map(String).join(" ").slice(0, 300));
    await act(async () => root.unmount());
    host.remove();
    const known = KNOWN_DEFECTS[type];
    if (known) {
      expect(messages.some((m) => m.includes(known)), `${type}'s known defect no longer happens: remove it from KNOWN_DEFECTS`).toBe(true);
      expect(messages.filter((m) => !m.includes(known) && !m.includes("unique \"key\""))).toEqual([]);
    } else {
      expect(messages).toEqual([]);
    }
    expect(ready, `${type} never mounted`).not.toBeNull();
  }, 30000);
});
