# Webmaster guide: fancy-cms-ui (authoring + React rendering)

For whoever builds and publishes pages with `@particle-academy/fancy-cms-ui`: the
human or agent authoring pages, and the developer mounting the editor and the
React renderer. It covers the authoring side: building pages that pass review,
the editor surfaces, and the client-side resolvers.

Related guides:

- `particle-academy/fancy-cms` (PHP) ships its own `agent-guide/webmaster.md`
  for the server side: the render route, CSP headers, CLIs and captures.
- `agent-guide/professional-pages.md` is the page bar agents build against
  (type and spacing scales, section order, batching ops). This guide extends it
  rather than repeating it.
- `agent-guide/fonts.md` is the full font reference/asset contract.

## 1. The surfaces

| Surface | Import | Use |
|---|---|---|
| `CmsPage` | `./react` or main | a published page; injects its stylesheet unless `includeStyles={false}` |
| `CmsRegion` | `./react` or main | one subtree (`root`) inside a hand-built page |
| `RenderNode` | `./react` or main | one node and its subtree |
| `Editor` | main or `./editor` | layers, canvas and inspector |
| `Canvas` | main or `./editor` | the editor canvas on its own |
| `EditablePage` | `./editor` only | inline on-page editing; needs the optional `@particle-academy/react-fancy` peer |

They all take the same host inputs. Pass **identical** values to SSR,
hydration and every editor surface:

- `imageResolver`: maps image asset handles to measured metadata.
- `fontResolver` and `fontDisplay`: resolve structured theme fonts.
- `icons`: the preloaded glyph map.
- `registry`: your custom element types.
- `data`: the binding context. `CmsRegion` has no `data` prop.

The editor in one line:

```tsx
<Editor value={doc} onOp={submit} disabled={pending}
  imageResolver={imageResolver} fontResolver={fontResolver} icons={icons} />
```

`value` + `onOp` is the controlled, server-owned mode; `defaultValue` +
`onChange` is the local mode. Choose one for the editor's lifetime.

## 2. What the built-in inspectors can and cannot edit

Know this before you rely on the UI alone to make a page review-ready.

- **The `Editor` inspector** edits text-node content, the image source (the
  `asset` handle, or `src` when the node has no `asset`), icon fields,
  background, text colour, font size, padding and opacity. It has **no field**
  for alt text, heading level, `href` or button label.
- **The `EditablePage` inspector** edits content, label, and any string, number
  or boolean prop the node **already has** (so `alt`, `href`, `variant` and
  `level` appear only when present), plus text and box styles.
- **Both write styles to the `base` breakpoint only.** Responsive fixes (`md`,
  `lg`) and missing props go through ops:

```ts
submit({ t: "set_node_props", id: "hero-img", patch: { alt: "Two bakers shaping loaves at dawn" } });
submit({ t: "set_node_props", id: "hero-title", patch: { level: 1 } });
submit({ t: "set_style", id: "plans", breakpoint: "md", patch: { columns: 2 } });
```

**The Add menu inserts placeholders. Replace every one before publishing:**

| Added | Default to replace |
|---|---|
| button | `label: "Button"`, `href: "#"` |
| link | `content: "link text"`, `href: "#"` |
| image | `src: ""`, `alt: ""`, and no `asset` (set the catalogue handle) |
| heading | `content: "New heading"` and no `level` (renders `h2`) |
| text | `content: "New text"` |
| icon | `name: "check"`, `decorative: true` |

`ADD_MENU`, `ADD_DEFAULTS` and `buildInsertOp` are exported if you want your
own palette with better defaults. The built-in menu also offers **Rich text**
and **Repeater**; see section 5 for why agent-authored pages should not use
Rich text.

## 3. Fonts

**What goes wrong.** A theme can name a font without loading it:
`font.body: "Inter, system-ui, sans-serif"` is a plain CSS string, and each
visitor gets whatever their machine has. In practice, a 1280px headline wrapped
to 3 lines on Windows and 4 on Linux. A layout "fitted" in one browser broke in
another.

**The fix.** Use a structured reference at `theme.font.<role>`:

```ts
submit({ t: "set_theme", patch: { font: {
  body: { family: "Inter", source: "bundled", weights: [400, 600, 700] },
} } });
// node styles: { fontFamily: "var(--cms-font-body)" }
```

Then give every surface a `fontResolver` (type `FontAssetResolver`) that
returns same-origin WOFF2 faces. The bundled Inter 4.1 is opt-in. Build its
asset once, at build time, and import the same object on server and client:

```ts
// build step (Node)
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { FontAsset } from "@particle-academy/fancy-cms-ui";

const require = createRequire(import.meta.url);
const bytes = readFileSync(require.resolve("@particle-academy/fancy-cms-ui/fonts/inter/manifest.json"));
const manifest = JSON.parse(bytes.toString("utf8"));

export const inter: FontAsset = {
  family: "Inter",
  source: "bundled",
  // Same digest particle-academy/fancy-cms's BundledFonts::interAsset uses,
  // so PHP and React emit the same "cms-font-<sha>" alias.
  manifestSha256: createHash("sha256").update(bytes).digest("hex"),
  faces: manifest.faces.map((f: { sha256: string; weight: [number, number]; style: "normal" | "italic" }) => ({
    src: `/site-fonts/${f.sha256}.woff2`, sha256: f.sha256, weight: f.weight, style: f.style,
  })),
};
```

```ts
import type { FontAssetResolver } from "@particle-academy/fancy-cms-ui";
export const fontResolver: FontAssetResolver = (ref) =>
  ref.source === "bundled" && ref.family === "Inter" ? inter : null;
```

The host copies each `fonts/inter/<file>` to `/site-fonts/<sha256>.woff2` and
serves it, keeping `OFL.txt` and `NOTICE` alongside.

Rules:

- **Never hot-link Google Fonts.** The package has no importer. For a
  `source: "google"` family, the host downloads the files, checks the licence,
  serves them same-origin and returns them from the resolver. This keeps
  `font-src 'self'` intact and sends no visitor data to a third party.
- **`fontDisplay`.** Use `"swap"` (the default) for live pages and `"block"`
  for captures.
- **A failed font throws `FontResolutionException`** (from `./react` or main)
  with a constant `reason`. This happens on every surface, including the editor
  canvas and `includeStyles={false}`. A document with a structured font but no
  `fontResolver` throws `missing-resolver`. A live page should show an operator-visible error; a
  capture must refuse.

```tsx
try {
  html = renderToString(<CmsPage doc={doc} fontResolver={fontResolver} imageResolver={imageResolver} icons={icons} />);
} catch (error) {
  if (error instanceof FontResolutionException) return operatorError(error.reason);
  throw error;
}
```

- **`document.fonts.ready` does not prove a font loaded.** Check that the faces
  of the `cms-font-<manifestSha256>` family report `loaded`.
- **Never shrink type to fit one machine's fallback font.** Load the real font,
  then fit.

## 4. Images

Use real images from the brief, chosen from the host catalogue. Near-identical
generic stock photos read as "repetitive" and "template-like".

```tsx
import type { ImageAssetResolver } from "@particle-academy/fancy-cms-ui/react";

const imageResolver: ImageAssetResolver = (handle) => catalogue[handle] ?? null;
// Image node props: { asset: "brief/hero-workshop", alt: "Two bakers shaping loaves at dawn", fit: "cover", loading: "eager" }
```

- **Resolved metadata.** The resolver returns `{ src, width, height, variants?, sizes? }`.
  The renderer emits intrinsic `width`/`height` (no layout shift), plus
  `srcSet` and `sizes` when there are variants. `sizes` is required whenever
  variants exist.
- **Same-origin sources.** Return root-relative `src` values when the published
  route sets `img-src 'self'`.
- **Fail closed.** An unknown handle renders an `<img>` with no source. It never
  falls back to `props.src`. Nodes without `asset` keep legacy `src`, so a
  closed-catalogue host must validate documents server-side.
- **Alt text.** Every content image needs real alt text, and the `Editor`
  inspector has no alt field (section 2). An image with no `alt` renders
  `alt=""`, which marks it decorative. For a truly decorative image, leave alt
  empty deliberately. `props.decorative` is accepted only on `frame`, `shape` and
  `icon`, not on images.
- **Frames fill consistently.** The base stylesheet makes an image fill its
  node box with `object-fit: cover`. Give every image in a row the same
  `aspectRatio` style (for example `"4 / 3"`). Don't letterbox one card
  (`fit: "contain"`) and not the next.
- **Loading.** The default is `lazy`. Set `loading: "eager"` on the hero; it
  also gets a preload hint. There is no render-wide eager switch, so a capture
  harness must load every image itself, then require each `<img>` to be
  complete with a non-zero `naturalWidth`.

## 5. Styles, CSP and inert output

- **The renderer emits no `style` attributes.** All page CSS comes from
  `emitDocCss`, keyed by `[data-cms="<id>"]`. Icon wrapper sizing is in the
  base stylesheet. `tests/no-inline-styles.test.tsx` holds this.
- **`CmsPage`/`CmsRegion` inject `<style data-cms-styles="">` with no `nonce`
  prop.** For a strict `style-src`, render with `includeStyles={false}` and
  deliver the same CSS yourself, in a nonce'd `<style>` or a same-origin file.
  The host chooses which:

```tsx
import { emitDocCss } from "@particle-academy/fancy-cms-ui";
import { CmsPage } from "@particle-academy/fancy-cms-ui/react";
import { renderToStaticMarkup } from "react-dom/server";

const css = emitDocCss(doc, { fontResolver, fontDisplay: "swap" });
const body = renderToStaticMarkup(
  <CmsPage doc={doc} includeStyles={false} imageResolver={imageResolver} icons={icons} fontResolver={fontResolver} fontDisplay="swap" />,
);
// Host shell: <style nonce="..."> + css + </style>, then body.
```

- **Recommended host CSP for agent-authored pages** (host configuration, not a
  package feature): `default-src 'none'; script-src 'none'; style-src 'nonce-...'; img-src 'self'; font-src 'self'; base-uri 'none'`.
  With `script-src 'none'` the page is static SSR output: islands stay empty,
  and animations, actions and repeater behaviour do not run.
- **Links.** `href` keeps relative URLs, fragments and `http`, `https`, `mailto`
  and `tel`. Any other scheme is dropped. External links get
  `rel="noopener noreferrer"`.
- **`richtext` renders its `html` prop as-is** (`dangerouslySetInnerHTML`).
  Exclude it for agent or untrusted authors and enforce that on the server;
  `particle-academy/fancy-cms` accepts an explicit node-type list.
- **The editor is not a published page.** Its chrome uses React inline style
  props and its canvas injects the page `<style>`. Serve it on an authenticated
  route with its own policy.

## 6. Accessibility

How nodes render:

- **Headings.** `heading` becomes `h1`-`h6` from `props.level`. A missing or
  invalid level gives `h2`, and empty content renders the text "Heading".
- **Text, lists and landmarks.** `text` is a `p`; `list` is a `ul`, or an `ol`
  when `ordered` is true. `section` and the containers take `props.as`:
  `header`, `nav`, `main`, `footer`, `article`, `aside`, `section` or `div`.
- **Links and buttons.** `link`/`button` render an `a` **only when `href` is
  set**. Without it they render a `span`/`div` that cannot be focused.
- **Icons.** An `icon` with `decorative: false` gets `role="img"` plus its
  `label` as `aria-label`. A decorative icon is `aria-hidden`.
- **Decorative art.** `frame`/`shape` with `decorative: true` are
  `aria-hidden`. `decorationError(doc.nodes)` reports a decorative subtree that
  holds meaningful content, and the reducers refuse such edits.

What review scores:

- **Exactly one `h1`, no skipped levels.** Check the DOM, not the screenshot:
  visual size can hide a broken outline.
- **Text at least 14px**, including captions, chips and helper text.
- **Contrast.** Grey secondary text must clear WCAG AA (4.5:1, or 3:1 for large
  text). A primary button is white on `--cms-color-primary`, so choose a primary
  that clears 4.5:1 against white.
- **Tap targets at least 44px on mobile.** The base button is about 41px with
  16px text (10px vertical padding, 1.2 line height, 1px border), so set
  `paddingY` 12. The mobile header CTA should be a `button` node, not a small
  `link`.
- **Distinct names.** Give repeated CTAs distinct visible labels ("Start your
  free trial with Solo"). Visible text is the accessible name (see
  Limitations).
- **Anchors and footer.** Use `props.anchor` (a lowercase slug, rendered as
  `id`) and point footer links at `#<anchor>`.

## 7. Responsive

- **Breakpoints** are `base` (0), `md` (768px) and `lg` (1024px). 1280 renders
  the `lg` styles.
- **No horizontal overflow at 375, 768 or 1280.** Measure
  `document.documentElement.scrollWidth`; don't eyeball it. A `grid` with
  `columnMin` cannot overflow by itself. Fixed widths and wide `free` layouts
  can.
- **Leave about 10% slack** on headline measure. Fonts and platforms vary.
- **Tablet (768) is the most often cramped.** Use `columns: 2` at `md` (a third
  card starts a second row) and `columns: 3` at `lg`, or stacked rows, rather
  than three squeezed columns. Grid nodes have no column-span style. Keep
  the primary CTA in the header from `md` up, and use the per-breakpoint
  `hidden` style to swap layouts.
- **Align rows.** Cards in a grid row stretch to equal height. Keep titles of a
  similar length so their baselines line up.

## 8. Content truth

- Every fact comes from the brief: prices, plan names, integrations,
  testimonials and stats.
- Don't invent "Most popular", extra integrations, sample totals, customer
  names or dates.
- Include every required fact. A missing price or missing social proof fails
  review like an invented one.
- Placeholder UI panels may carry brief facts as labels. Use decorative
  `frame`/`shape` skeletons where no fact exists.

## 9. Design that review rewarded

- **A balanced desktop hero.** The headline sits in about 3 lines, the image
  matches the text block's height (tune the image's `aspectRatio` at `lg`, then
  measure both boxes at 1280), and there is clear space above the CTA row.
- **A designed proof band.** Align the stat and the quote, give the quote real
  typographic treatment, and pair the attribution with an initial mark.
- **A real footer** (`props.as: "footer"`) with links to the page's own
  sections.
- **Specific, not template-generic.** Use the brief's photos, words and brand
  colour.

## 10. Icons

The full Lucide catalogue is available through `icon` nodes. Search it with
`searchIcons(query, cursor)` (at most 20 names per call); `iconNames()` returns
the closed name list. Props are literal: `name`, `decorative` and, when
`decorative: false`, a nonblank `label`. Size with `style.fontSize` and colour
with `style.color`. Wrapper sizing is in the base stylesheet, with no inline
styles.

Glyphs are opt-in data. Load the ones the document uses, then pass the same map
to SSR, hydration and the editor:

```ts
import { loadIcons } from "@particle-academy/fancy-cms-ui/icons";

const names = Object.values(doc.nodes)
  .filter((n) => n.type === "icon" && typeof n.props.name === "string")
  .map((n) => n.props.name as string);
const icons = await loadIcons(names);
```

A glyph missing from the map renders empty. `./icons/<name>` imports one glyph;
`./icons/all` imports the full set.

## 11. Verify before publishing

Capture each page at 375, 768 and 1280 in a real browser, rendered with
`fontDisplay: "block"`, then check:

- [ ] `scrollWidth` is no wider than the viewport at all three widths.
- [ ] Exactly one `h1`, with no skipped heading levels (from the DOM).
- [ ] Every content image has alt text; decorative ones are empty on purpose.
- [ ] Every `<img>` is complete with a non-zero `naturalWidth`.
- [ ] The `cms-font-*` faces report loaded.
- [ ] Text is at least 14px and secondary text clears AA contrast.
- [ ] Tap targets are at least 44px at 375, and the header CTA is a real button.
- [ ] No `href: "#"` or Add-menu placeholder text remains.
- [ ] Every brief fact is present and exact, and nothing is invented.

Any capture tool works; the package depends on none. If you use prism-browser,
turn on its image and font requirements (`requireImages`, `requireFonts`; check
that tool's own docs) so a broken image or a fallback font refuses instead of
passing.

## 12. Current limitations

- **No `aria-label` on link or button nodes.** Visible text is the accessible
  name.
- **No `object-position` on image nodes.** Images crop around the centre.
  Workaround: have the host crop variants with the subject centred, or pick an
  `aspectRatio` close to the source's.
- **Code blocks are 13px.** The base stylesheet fixes `font-size: 13px` on the
  `pre` inside a `code` node, and a node `fontSize` does not reach it.
  Workaround: a host rule such as `[data-cms] > pre { font-size: 14px; }`.
- **The built-in inspectors write `base` styles only** and the `Editor`
  inspector has no alt, level, `href` or label fields. Use ops (section 2).
- **No `nonce` prop on the injected `<style>`.** Use `includeStyles={false}`
  (section 5).
- **`CmsRegion` emits the whole document's CSS** and has no `data` prop, so
  bindings inside a region render empty.
