/**
 * The browser half of "the stylesheet goes in `<head>`" (render/style-tag.ts).
 */
import { useInsertionEffect, type ReactElement } from "react";
import type { PageDoc } from "../document/types";
import type { FontRenderOptions } from "../render/fonts";
import { cmsStyleText, styleKey } from "../render/style-tag";

/** One style element per document key, shared by every mounted page that renders it. */
const owned = new Map<string, { el: HTMLStyleElement; css: string; users: number }>();

function existing(key: string, css: string): HTMLStyleElement | null {
  for (const el of Array.from(document.head.querySelectorAll<HTMLStyleElement>("style[data-cms-styles]"))) {
    if (el.getAttribute("data-cms-styles") === key && el.textContent === css) return el;
  }
  return null;
}

/**
 * Keep `css` in `document.head` while the calling component is mounted. A
 * style element with the same key and the same text already in the head (put
 * there by the server, or by Inertia's `<Head>`) is used as it is and never
 * removed; otherwise one is created, shared by key, and removed with its last
 * user. Nothing runs on the server.
 */
export function useCmsHeadStyles(key: string, css: string): void {
  useInsertionEffect(() => {
    if (css === "" || typeof document === "undefined") return;
    const id = `${key}\u0000${css}`;
    const mine = owned.get(id);
    if (mine) {
      mine.users++;
    } else if (!existing(key, css)) {
      const el = document.createElement("style");
      el.setAttribute("data-cms-styles", key);
      el.textContent = css;
      document.head.appendChild(el);
      owned.set(id, { el, css, users: 1 });
    } else {
      return;
    }
    return () => {
      const entry = owned.get(id);
      if (!entry) return;
      entry.users--;
      if (entry.users <= 0) {
        entry.el.remove();
        owned.delete(id);
      }
    };
  }, [key, css]);
}

/**
 * The document's `<style>` as a React element, for a head manager such as
 * Inertia's `<Head>`, which writes it into the server-rendered `<head>`:
 *
 *   <Head>{cmsHeadStyle(page.doc)}</Head>
 *   <CmsPage doc={page.doc} includeStyles={false} />
 *
 * Its text is {@link cmsStyleText}, so it renders the same bytes as
 * `cmsStyleTag(doc)`. A head API that wants the text alone takes
 * `cmsStyleText(doc)` directly.
 */
export function cmsHeadStyle(doc: PageDoc, options: FontRenderOptions = {}): ReactElement {
  return <style data-cms-styles={styleKey(doc)}>{cmsStyleText(doc, options)}</style>;
}
