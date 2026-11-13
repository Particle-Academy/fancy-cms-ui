/**
 * Which text nodes may break a word anywhere (lab finding S11, and the 0.14.0
 * regression its first fix caused).
 *
 * Text nodes get `overflow-wrap: break-word` from the base stylesheet: a word
 * breaks only when it cannot fit its line, and min-content is left alone, so
 * grid tracks and flex items still size to whole words, prices and stats. That
 * alone would let a long token (a URL, an email, hostile input) widen a track
 * or a flex row past the screen, so a node whose text holds one is marked
 * `data-cms-wrap="anywhere"` and gets `overflow-wrap: anywhere`, which lowers
 * that node's min-content only.
 *
 * A token is a run with no space, tab, newline, carriage return, form feed,
 * zero-width space, hyphen-minus, U+2010, en dash or em dash (the places a
 * browser may already break). Its length is counted in code points. Twin of
 * fancy-cms `TextWrap`; `tests/fixtures/text-wrap.json` is the shared spec.
 */
export const LONG_TOKEN = 20;

const SEPARATORS = /[ \t\n\r\f\u200b\u2010\u2013\u2014-]+/;

/** True when `text` holds a token of LONG_TOKEN code points or more. */
export function hasLongToken(text: string): boolean {
  if (text.length < LONG_TOKEN) return false;
  for (const token of text.split(SEPARATORS)) {
    if (token.length >= LONG_TOKEN && Array.from(token).length >= LONG_TOKEN) return true;
  }
  return false;
}

/** Node types the base text rule styles, and whose rendered text is checked. */
const MARKED = new Set(["text", "heading", "link", "callout", "list"]);

/**
 * The `data-cms-wrap` value for a node, or undefined. `content` is the node's
 * rendered text and `items` a list's rendered items.
 */
export function wrapFor(type: string, content: string, items: readonly string[]): "anywhere" | undefined {
  if (!MARKED.has(type)) return undefined;
  if (type === "list") return items.some(hasLongToken) ? "anywhere" : undefined;
  return hasLongToken(content) ? "anywhere" : undefined;
}
