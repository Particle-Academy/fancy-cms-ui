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
 *     Under Inertia, put `cmsHeadStyle(doc)` (./react) in `<Head>`. For any
 *     other head API, `cmsStyleText(doc)` is the element's text alone.
 *
 * Only these document-shaped functions are public. The builder that turns an
 * arbitrary CSS string into a `<style>` element, {@link styleTagHtml}, is
 * module-internal: a host never needs to hand it CSS that did not come from
 * the emitter, so the package does not offer to.
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

/**
 * CSS made safe as the raw text of a `<style>` element. Every `<` that starts
 * `</` or `<!` becomes the CSS hex escape `\3C ` (the space ends the escape and
 * is consumed by the CSS tokenizer), so no `</style` in any case can end the
 * element and no `<!--` survives. The escape means `<` in a string, an
 * identifier, an unquoted `url()` or a comment, so the CSS still says what it
 * said there. Any other `<` (a media range such as `width < 600px`) is left
 * alone: it cannot end the element. Mirrored by `PageRenderer::styleText`.
 *
 * Written as one global replace of a bare `<` (the decision about the next
 * character is in the callback) rather than a loop or a lookahead: that is the
 * shape static analysis recognises as an HTML metacharacter escape (CodeQL's
 * `MetacharEscapeSanitizer` needs the pattern's root to match `<` itself), and
 * it is linear, since a one-character pattern cannot backtrack.
 */
export function styleText(css: string): string {
  return css.replace(/</g, (lt: string, at: number) => {
    const next = css.charCodeAt(at + 1);
    return next === 47 /* / */ || next === 33 /* ! */ ? "\\3C " : lt;
  });
}

/**
 * A style element as HTML. Byte-identical to `PageRenderer::styleTag`, which
 * the shared fixtures hold it to. MODULE-INTERNAL: not exported from the
 * package index or any subpath, so no host can hand it arbitrary CSS. It goes
 * through {@link styleText} all the same.
 */
export function styleTagHtml(key: string, css: string): string {
  return `<style data-cms-styles="${escapeAttr(key)}">${styleText(css)}</style>`;
}

/**
 * The text of the document's `<style>` element: the emitted CSS made safe as
 * raw element text by {@link styleText}. For a host that renders the element
 * with its own head API, for example Inertia's `<Head><style>`. Empty for an
 * empty document.
 */
export function cmsStyleText(doc: PageDoc, options: FontRenderOptions = {}): string {
  return styleText(emitDocCss(doc, options));
}

/**
 * The document's `<style>` element as HTML, for the host's `<head>`. Empty for
 * an empty document. The emitter already rejects or hex-escapes every `<` an
 * author or agent wrote (`cssString`, `safeCssValue`, the font validators), and
 * {@link styleText} neutralises `</` and `<!` again, so the CSS cannot close
 * the element even if one of those gates regresses.
 */
export function cmsStyleTag(doc: PageDoc, options: FontRenderOptions = {}): string {
  const css = emitDocCss(doc, options);
  return css === "" ? "" : styleTagHtml(styleKey(doc), css);
}
