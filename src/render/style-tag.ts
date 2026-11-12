/**
 * Where a page's stylesheet goes: `<head>`, never the body.
 *
 * `CmsPage` used to render its `<style data-cms-styles>` next to the page's
 * nodes, which put it inside whatever `<div>` the host mounts the page in
 * (`#app` under Inertia). A `<style>` is not allowed there, so every page was
 * invalid HTML (lab finding K20). React 19's `<style precedence>` does not help
 * under Inertia SSR either: with no `<head>` in the React tree it is written at
 * the start of the app's own markup, inside the same `<div>`.
 *
 * So the CSS is handed to the HOST for its head, the way the PHP renderer has
 * always returned it (`PageRenderer::render()['css']`):
 *
 *   - server: `cmsStyleTag(doc)` is the `<style>` element as HTML, for a head
 *     template; `PageRenderer::styleTag($doc, $css)` writes the same bytes.
 *     Under Inertia, put `cmsHeadStyle(doc)` (./react) in `<Head>`.
 *   - browser: `CmsPage` keeps one `<style data-cms-styles="<doc id>">` per
 *     document in `document.head`, reusing an identical one the server put there.
 */
import type { PageDoc } from "../document/types";
import { emitDocCss } from "./css";
import type { FontRenderOptions } from "./fonts";

/** The attribute value a document's style element carries: its id, so each document has one. */
export function styleKey(doc: PageDoc): string {
  const id = (doc as { id?: unknown }).id;
  return typeof id === "string" ? id : "";
}

/** React's attribute escaping, which the PHP renderer reproduces. */
function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A style element as HTML, for a document's precompiled CSS. Byte-identical to `PageRenderer::styleTag`. */
export function styleTagHtml(key: string, css: string): string {
  return `<style data-cms-styles="${escapeAttr(key)}">${css}</style>`;
}

/**
 * The document's `<style>` element as HTML, for the host's `<head>`. Empty for
 * an empty document. The emitter escapes everything an author or agent wrote,
 * so the CSS cannot close the element.
 */
export function cmsStyleTag(doc: PageDoc, options: FontRenderOptions = {}): string {
  const css = emitDocCss(doc, options);
  return css === "" ? "" : styleTagHtml(styleKey(doc), css);
}
