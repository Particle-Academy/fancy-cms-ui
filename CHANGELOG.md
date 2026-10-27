# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Pre-1.0:** breaking changes land in MINOR releases. Read the entry, not the
> version number.

> **0.2.0 and 0.3.0 are missing below.** This file was last updated at 0.1.1 and
> the two releases after it were never written up; `git log` is the record for
> those. Noted rather than quietly back-filled from memory.

## [Unreleased]

## [0.13.1] - 2026-10-26

**Nothing to do:** documentation only.

### Added
- A webmaster guide, `agent-guide/webmaster.md`, shipped in the tarball: the
  authoring-side reference for building and publishing pages. It covers what
  the editor inspectors can and cannot edit, the Add-menu placeholders to
  replace, client-side image and font resolvers, strict-CSP rendering with
  `includeStyles={false}`, accessibility and responsive checks, pre-publish
  verification and current limitations. It pairs with the host guide in
  `particle-academy/fancy-cms`.

## [0.13.0] - 2026-10-26

**Nothing to do unless you opt in:** documents that keep string font tokens render byte-identically. To use a web font, pass a `fontResolver` that maps the reference to same-origin WOFF2 URLs you publish yourself; the renderer never fetches fonts or contacts Google.

### Added
- Structured `theme.font.<role>` references with a synchronous host `fontResolver`,
  manifest-derived families, same-origin WOFF2 `@font-face` output and explicit
  `FontResolutionException` reasons for missing or invalid fonts. Live output
  defaults to swap; trusted capture callers can select block. Page, region,
  node and editor surfaces validate fonts even when styles are supplied by the
  host. Legacy string tokens retain their exact output; PHP/JS parity covers
  both accepted and refused font metadata.
- Opt-in, unmodified Inter 4.1 variable normal/italic assets at
  `./fonts/inter/*`, including OFL licence, NOTICE and archive/file SHA256
  manifest. No automatic stylesheet, route, font request or new runtime dependency.

## [0.12.1] - 2026-10-26

### Fixed

- Native icons retain their 1em sizing and alignment under nonce-only Content
  Security Policy. Fixed wrapper declarations now live in the shared base
  stylesheet, and native rendering emits no generated inline style attributes.
  Nothing to do unless you relied on the inline style; the base stylesheet now
  carries it. PHP/React markup and CSS remain in parity.

## [0.12.0] - 2026-10-26

### Added

- Host-resolved responsive image assets via literal `props.asset` and the
  `imageResolver` prop, shared by page/region/node renderers and editor previews.
  Trusted intrinsic dimensions and declared variants/sizes match PHP byte for
  byte, including eager preload hints. Unknown or invalid assets stay inert
  without authored-URL fallback; legacy images without `asset` remain compatible.
- The inspector edits an asset handle through ordinary page operations. Public
  asset metadata types and a standalone CDN-manifest example are included;
  no new dependencies or application-specific storage are required.

## [0.11.0] - 2026-10-24

### Added

- Full Fancy Lucide 0.511.0 catalogue (1,803 names/aliases, 1,594 glyphs) and bounded
  `searchIcons(query,cursor)` for agent tools. Glyphs are separate opt-ins:
  `./icons/<name>` static modules, `./icons` async preloading and `./icons/all`.
  Renderer/editor `icons` maps keep the full SVG set out of core and allow
  synchronous, byte-identical SSR/hydration with selected glyphs. No new runtime
  dependency; react-fancy stays optional. Ships source version/content SHA256,
  Lucide ISC licence/NOTICE and offline generator/drift checks for both twins.

- Native `icon` leaf nodes with a closed catalogue, responsive token colour and
  font-size sizing, explicit decorative semantics and escaped accessible labels.
  Both editor inspectors expose catalogue choices and labelled controls; Add
  inserts a safe decorative icon through the existing operation spine.
- One generated SVG catalogue shared with fancy-cms and checked for drift;
  all-glyph HTML/CSS parity and valid/hostile operation parity, including wire
  undo when a meaningful edit first introduces an optional label.

### Changed

- Icon markup follows the Fancy Icon wrapper conventions, while rendering the
  shared static SVG data directly. It does not import react-fancy at runtime or
  use lazy icon lookup. The existing react-fancy peer stays optional; no new
  runtime dependency or entry-point migration is required.

### Security

- Literal decorative flags on frame/shape hide only passive artwork. Both
  reducers refuse meaningful subtree inserts/moves, action edits and unsafe prop merges;
  the renderer leaves malformed stored content visible. Validation is iterative
  and fresh per render, including CmsPage, CmsRegion and RenderNode. Wire undo
  restores the entire subtree when the optional flag was originally absent.
- **BREAKING for documents using `decorative` as unrelated metadata:** reserve
  this prop for frame/shape/icon and rename it on other node types. Documents
  without it need no change; react-fancy remains an optional peer.

- Both insertion and merged icon-prop edits refuse unknown names, SVG/path
  payloads, bindings, extra attributes and invalid accessibility combinations.
  Rejected edits leave the document and sequence unchanged. Icons are leaves;
  malformed direct rendering emits no glyph or meaningful-image role.
- **undici 7.30.1 in development** (was 7.30.0, through jsdom), clearing
  GHSA-xjj6-f33q-929c (HIGH: a malicious content-encoding response can crash
  Node's fetch). Test tooling only: nothing in the published package uses it,
  so **nothing to do** as a consumer.

## [0.10.0] - 2026-10-23

### Added

- `Editor` accepts controlled `value`, native-operation `onOp` and `disabled`
  props for server-owned shared documents. Local edits propose changes; only
  the next host value changes the controlled document. Incoming values preserve
  the selected handle and never echo through either callback. Local snapshot
  Undo/Redo is disabled in controlled mode to protect other writers' work.
  - Inspector fields keep a local draft, so typing survives server latency,
    including while `disabled` pauses structural edits and submissions. Drafts
    commit after 250 ms idle or on blur, one acknowledgement at a time, and
    wait for IME composition to finish.
  - When another writer changes the field being drafted, a save is rejected or
    never acknowledged, or the node is removed, the draft is kept and the
    inspector offers **Use server value** / **Keep draft**. Text is never
    silently lost or overwritten.
  - The host contract (compare-and-set, serialization, pending, unmount) is in
    the README. Nothing changes for an uncontrolled `Editor`.

### Fixed

- An uncontrolled `Editor` mounted under React StrictMode no longer emits an
  initial `onChange` before any edit.

### Security

- **vitest 4.1.12 in development** (was 4.1.11), clearing GHSA-qxg6-89mg-rqv8
  and GHSA-xp26-3454-mjgp in `@vitest/mocker`. Test tooling only: nothing in
  the published package changes, so **nothing to do** as a consumer.

## [0.9.0] - 2026-10-23

Released together with `particle-academy/fancy-cms` 0.5.0, whose PHP renderer
emits the same markup and CSS: all five canonical documents are byte-identical
in both `parity/run.mjs` (CSS) and `parity/html.mjs` (HTML).

Found by rendering the lab's reference page server-side and capturing it at
phone and desktop widths: browser-default margins stacked on top of every
layout's `gap`, buttons were underlined links, and the JS and PHP renderers
produced different markup because the JS one used inline style objects.

### Changed

- **BREAKING (markup + CSS): one fixed base stylesheet replaces inline styles.**
  `emitDocCss` now emits `BASE_CSS` first: it resets the margins of headings,
  paragraphs and lists, sets `box-sizing`, and styles buttons, callouts, code,
  dividers and images. Every rule is wrapped in `:where()`, is never more
  specific than a node's own `[data-cms="<id>"]` rule and comes before it, so
  whatever a node sets wins. Elements carry data attributes instead:
  - a `button` is ONE element, the `<a>` (or `<div>` without an href), with
    `data-cms-button="primary|outline|ghost"`; there is no inner `<span>`;
  - a `callout` is `data-cms-callout="info|success|warning|danger"` with its
    text directly inside;
  - an `image` keeps `<img>` and carries `data-cms-fit` when not `cover`;
  - `divider` and `code` render bare `<hr>` and `<pre><code>`.
  Buttons and callouts take `var(--cms-color-primary)` when the theme sets it.
  **What to do:** nothing, unless your CSS targeted the old inner
  `span[data-cms-button]` or your design relied on browser-default margins;
  set the margin on the node instead. Unknown variants fall back to the
  default rather than being written into the attribute.
- `emitDocCss` emits the base whenever a document has nodes or theme tokens,
  even if no node sets a style; an empty document still emits nothing.

### Fixed

- A node with no `props` or no `style` (a stored or legacy node) crashed both
  the renderer and the emitter, taking the whole page with it. Both now read
  nodes through `withNodeDefaults` (exported).
- A breakpoint named after an `Object.prototype` member (`constructor`, ...)
  made the emitter print a function into a media query; breakpoint and
  per-breakpoint lookups are now own-property only.
- An image with no `src` rendered `src=""`, which makes a browser request the
  page again; the attribute is now omitted.

### Added

- The parity runners call PHP without a shell (`FANCY_CMS_PHP` overrides the
  binary), so a fixture's filename can never be read as shell text.
- `parity/html.mjs`: the markup half of the parity gate. It renders every
  canonical document with `CmsPage` and with fancy-cms's PHP renderer and
  requires byte-identical HTML. `canonical-page-ledgerline.json` is the lab's
  premium reference page, so a real page is in the corpus.

## [0.8.0] - 2026-10-23

What a professional landing page needs from the renderer, found by mapping
the stack for the lab's website-builder agent.

### Changed

- **BREAKING (markup): the `[data-cms]` element is now the semantic element.**
  `heading` renders `<h1>`-`<h6>` (`props.level`, default 2), `text` renders
  `<p>`, `section` renders `<section>`, `button` and `link` with a safe `href`
  render `<a>`, and `list` renders `<ul>`/`<ol>`. Previously every node was a
  `<div>`. **What to do:** nothing, unless your own CSS targets
  `div[data-cms]` or `[data-cms] > a` (the inner `<a>` of a `link` is gone;
  the link IS the element now). Select by `[data-cms="<id>"]`, which is
  unchanged.
- **BREAKING (security, CSS): a style value that could escape its declaration
  is dropped.** A value containing `{`, `}` or `<`, or a `;` outside
  parentheses or quotes, emits nothing. **What to do:** nothing for any real
  colour, gradient, font stack or `url(data:...;base64,...)`, which all still
  pass. Only a value that was trying to close the rule changes.
- `direction`, `columns` and the new container knobs are read **per
  breakpoint**. A grid can now go 1 column -> 2 -> 3, and a stack column ->
  row. Base output is unchanged.

### Added

- Style properties: `paddingX` / `paddingY`, `marginX` (`"auto"` centres) /
  `marginY`, `maxWidth`, `minHeight`, `aspectRatio`, `sticky`, `zIndex`,
  `overflow`, `hidden` (per breakpoint), `textTransform`, `backgroundSize`,
  `backgroundPosition`, `wrap`, and `columnMin` for an auto-fit grid that is
  responsive with no breakpoints at all.
- **Theme tokens are emitted** as `:root { --cms-* }` custom properties
  (`theme.color.primary` -> `--cms-color-primary`), so styles can reference
  `var(--cms-color-primary)`.
- `props.as` on containers: `section`, `header`, `nav`, `main`, `footer`,
  `article`, `aside`, `div`. Anything else is ignored, never used as a tag.
- `list` element (`props.items`, `props.ordered`), and List in the editor's add menu.
- `props.anchor` on any node renders as its `id`, so an in-page link
  (`href="#pricing"`) has somewhere to land. Only a lowercase slug of up to 64
  characters is rendered (`ANCHOR_PATTERN`, `anchorFor` exported); anything
  else is ignored. The PHP renderer follows in fancy-cms 0.5.0.
- `image`: `props.fit` (`cover` default, `contain`, `fill`, `none`,
  `scale-down`) and `props.loading` (lazy by default).
- **`agent-guide/professional-pages.md`**, shipped in the tarball: how an agent
  builds a professional page with these primitives (the bar, scales, batching
  ops, deferring to a person's edits). It is what the lab's website-builder
  agent is measured with, so its numbers are tuned by lab passes, not by taste.
- `safeHref`, `elementFor`, `LANDMARK_TAGS` and `safeCssValue` are exported.
  Hrefs pass for relative URLs and `http`/`https`/`mailto`/`tel`; every other
  scheme (`javascript:`, `data:` ...) is dropped. External http(s) links get
  `rel="noopener noreferrer"`.
- **Security: nothing a document holds can escape the inline stylesheet.**
  Two routes carried raw strings into `<style>`. A node id went into
  `[data-cms="<id>"]` unescaped, so an id containing `</style><script>` ended
  the stylesheet and injected a script; ids now pass through `cssString`
  (`\` and `"` escaped, control characters and `<` as hex escapes), and the
  selector still matches the attribute. And `align`, `justify`, `direction`,
  `textAlign`, a Length's unit and the numeric fields were written without a
  check; now a Length needs a finite number and a known unit, a keyword must be
  on its allowlist, and a number must be finite, or the declaration is dropped.
  **Nothing to do:** every valid document emits the same CSS as before.
  `parity/canonical-doc-hostile.json` holds the PHP emitter to the same rules.
  Found by the PHP port's source review.
- **Security / Fixed: node ids and breakpoint names that are also
  `Object.prototype` names.** Ids arrive in ops, which an agent writes. The node
  map was read as a plain object, so `constructor`, `toString` and friends
  resolved to built-ins: inserting a node called `constructor` was refused as a
  duplicate, removing an absent `toString` "succeeded" and bumped `seq`, and a
  node called `__proto__` replaced the map's prototype instead of being added.
  Every lookup and write in the reducer, renderer, CSS emitter and migration now
  uses own properties only (`src/document/own.ts`). **Nothing to do:** a page
  whose ids are ordinary strings behaves exactly as before. Found by the PHP
  port, which has no prototype to see.
- **Fixed:** `reorder_roots` accepted a list that repeated a root as long as
  its length matched (`["s1","s1"]` for roots s1, s2), rewrote that root's key
  twice and left the other's alone, so the page order became arbitrary. It is
  now refused as not a permutation, like a list with an unknown id. Found while
  porting the reducer to PHP.
- Parity: `parity/run.mjs` checks every `parity/canonical*.json`;
  `canonical-doc-0.8.json` covers the new properties and the values that must
  be dropped.

### Fixed

- **`CHANGELOG.md` is now in the published tarball.** `files` did not whitelist it, so npm never shipped it — and this package puts breaking changes in MINOR releases and tells you in the README to read the entry before taking one. The instruction existed for the author, who has the file, and not for the consumer, who is the only one being instructed. Nothing for you to do; the file simply arrives from this release on.
- Dropped `docs` from `files`: it was declared and never existed, so the package claimed to ship it and did not.

### Security

- `source-map-js` is pinned forward to `^1.2.2` via `overrides`. Versions up to
  1.2.1 allow an event-loop denial of service through indexed source-map section
  offsets, and it arrives here transitively through the build toolchain.
  **Nothing for a consumer to do, and no runtime change**: an npm package does
  not ship a lockfile, so this governs builds OF this repo, not anything
  installed FROM it. Recorded rather than left silent because the override it
  sits beside — `shell-quote` `^1.9.0`, added for an earlier advisory — was
  carried with no note of why, and had drifted back inside the vulnerable range
  before anyone looked.
- **Dev toolchain only — no runtime change, nothing for consumers to do.** The
  lockfile now resolves `vite` 8.3.5 (was 8.3.0), whose bundled
  `launch-editor` fixes GHSA-587h-7wmj-h5pm (HIGH, `fs.existsSync()` check
  bypassable on Windows), GHSA-698v-4r3x-3vcv (`escapeCmdArgs()` omits `%`
  escaping on Windows) and GHSA-r825-w8mm-5pxw (editor CLI flag
  misinterpretation). `vite` is only reached through the test/dev toolchain
  and the published package does not ship our lockfile, so the exposure was
  this repo's own dev server.

## [0.7.1] — 2026-09-17

### Fixed

- **Malformed authored documents now render empty instead of throwing during
  React render.** `CmsPage` normalizes a missing, null, array, or otherwise
  invalid `nodes` map at its migration boundary, while direct `emitDocCss()`
  and `rootIds()` calls defensively return empty results. A bad agent-authored
  value can no longer unmount the host subtree around the CMS page.

  **What you must do:** nothing. Well-formed documents render unchanged; the
  fallback only applies when `nodes` is not a non-null object.

## [0.7.0] — 2026-08-09

### Added

- **`$source` on a binding — where its data comes from, in the Live Contract's
  vocabulary.** Story #171, AC2.

  ```ts
  { $bind: "products.0.name", $source: ["catalog", "products"] }
  ```

  `{ $bind: "profile.coins" }` is a path into whatever blob the host passes as
  `data`. It says nothing about which query produced that blob, so nothing could
  know what to re-render when the underlying data changed — a host wiring live
  data had to work it out per page, by hand.

  `$source` names it in the same `[namespace, resource, …]` shape
  `fancy-query`'s `liveKey()` produces and every backend twin declares its
  broadcast events against. This is exactly why the work was gated behind the
  Live Contract: had the substrate invented its own name for "where this data
  lives", that vocabulary would have been baked into every **saved document**.

  - `bindingSources(doc)` answers *what live queries does this page read?* —
    walking props and a repeater's `each`, which is the densest data dependency
    in the model.
  - A malformed `$source` reads as absent rather than throwing. Documents arrive
    from databases and from agents; a renderer that throws takes the page down.
  - Deliberately a plain array — structurally a TanStack `QueryKey` without the
    dependency, and it survives JSON.

  **What you must do:** nothing. `$source` is optional, and every document saved
  before this has none.

- **Asserts `fancy-doc-commons`' `CANONICAL_WALKS`** — the shared fixture
  `fancy-screens` asserts too, so both surfaces are checked against one tree
  rather than each being inspected separately (AC1).

### Changed

- `@particle-academy/fancy-doc-commons` to `>=0.4 <2.0`.

## [0.6.0] — 2026-08-09

### Changed

- **BREAKING — the `set_props` op is now `set_node_props`.**

  `@particle-academy/fancy-doc-commons`' `TreeOp` uses the same discriminator
  `t` and also had a `set_props` variant, with a byte-identical shape. So a
  stored `{ t: "set_props", id, patch }` was **valid under two vocabularies and
  reduced by two different reducers**, with nothing in the document able to say
  which one it meant. Now that `PageDoc` IS a `DocTree`, both reducers can
  plausibly be handed the same document.

  **What you must do:** if you emit this op directly, rename the tag. If you
  only use `Editor`, `EditablePage`, `Inspector` or `useEditor`, nothing — they
  emit it for you. Stored documents are unaffected: this is an op vocabulary,
  not a document field, so nothing persisted contains it.

  Every other variant was already disjoint (`insert_node` vs `insert`,
  `move_node` vs `move`), so closing the collision cost exactly one rename. The
  alternative on the table was a versioned envelope (`{v:"tree/1", t:…}`) on
  every op across the kit; that would have been the right answer if the overlap
  were wide, and it is one variant.

### Added

- A test asserting the two vocabularies stay **disjoint**, so the next
  collision fails the build rather than shipping. Keeping tag spaces disjoint
  is the cheap version of a versioned envelope — but only while something
  checks.


### Added

- The migration is now tested against a **real saved document** — the showcase's
  own CMS home page as it was actually persisted before 0.5.0, 62 nodes and
  seven sections, extracted from `px-ui-sandbox` at the commit before the
  migration landed. A hand-built fixture only contains the cases its author
  already thought of.

  That document's `sections` happens to agree with its order keys, because
  nobody ever reordered it — so a further test permutes `sections` and leaves
  the keys alone, which is exactly what the old `reorder_sections` op did, and
  asserts the migration recovers the dragged order.

## [0.5.1] — 2026-08-09

### Fixed

- **`NodeTransform` is exported from the `/editor` entry.** It appears in two of
  `EditablePage`'s props — `transforms?: Record<string, NodeTransform>` and
  `onNodeTransform?: (id, transform: NodeTransform) => void` — but had never
  been exported, so a consumer writing an `onNodeTransform` handler had no way
  to name its second argument. The showcase imported it anyway and carried a
  permanent type error in the app that exists to demonstrate this package.

  **What you must do:** nothing. This only adds an export.

  The gap was invisible from inside the package: it built and tested clean, and
  only a CONSUMER could discover it. There is now a type-only fixture
  (`tests/editor-exports.types.ts`) that imports every public prop type through
  the same barrel a consumer uses, so the next one fails the build here rather
  than in someone else's app.

### Added

- `tsconfig.test.json`, wired into `npm run lint`. `tests/` was excluded from
  type checking entirely, so test files were unchecked TypeScript — turning it
  on surfaced four real type errors that had been sitting in the suite.

## [0.5.0] — 2026-08-09

### Added

- `migrateDoc(doc)` / `migrateDocVerbose(doc)` / `needsMigration(doc)` — forward
  migration for documents saved before this release. Idempotent, and returns an
  already-migrated document by reference, so it is safe to call unconditionally
  on load. `migrateDocVerbose` additionally reports `danglingIds` (ids listed in
  `sections[]` with no matching node) and `unlistedRootIds` (roots the array
  never mentioned, which previously did not render at all).
- `rootIds(doc)` and `lastRootId(doc)` on `document/reduce` — the two things
  callers actually wanted from `doc.sections`.

### Changed

- **BREAKING — `PageDoc.sections[]` is gone; roots are ordered by their `order`
  key like every other sibling group.** `PageDoc` is now a `DocTree` from
  `@particle-academy/fancy-doc-commons`, so `childrenOf`, `roots` and
  `descendantsOf` from that package work on a CMS document directly.

  **What you must do:**

  - **Reading `doc.sections`** → use `rootIds(doc)`.
  - **Emitting the `reorder_sections` op** → it is now `reorder_roots`, and it
    rewrites the roots' `order` keys rather than permuting an array. The payload
    shape (`{ t, order: NodeId[] }`) is unchanged.
  - **Loading documents you persisted before this release** → nothing, if you
    go through `CmsPage` or `initEditor`; both migrate on the way in. If you
    read a stored document yourself — to index it, diff it, or render it on a
    server — call `migrateDoc` first.

  This one genuinely bites, so it is worth being precise about why: the old
  `reorder_sections` permuted `sections[]` and left every node's `order` key
  untouched. On any page whose sections were ever dragged into a new order, the
  keys are stale and the array is the **only** record of the real order. So a
  consumer who drops the array and falls back to the keys does not lose a
  redundant field — that page silently reverts to the order it was first
  authored in. Nothing throws, nothing logs, and the layout is wrong. That is
  the case `migrateDoc` exists for, and the reason both entry points call it
  for you.

- Top-level order used to live in its own array while every other level used
  fractional keys — two ordering mechanisms that could disagree. A node could be
  a root by `parent === null` and absent from `sections[]`, and then simply not
  render. That is now unrepresentable.

### Removed

- **BREAKING — `src/document/fractional.ts` is deleted.** `keyBetween` is still
  exported from the package root, now re-exported from
  `@particle-academy/fancy-doc-commons` (which also exports it as
  `fractionalKey`).

  **What you must do:** if you imported `keyBetween` from the package root,
  nothing — it is the same function and produces byte-identical keys, which the
  test suite pins against golden values captured from the deleted
  implementation. If you deep-imported `@particle-academy/fancy-cms-ui/dist/document/fractional`,
  import from the package root instead.

## [0.4.0] — 2026-08-07

### Changed

- **BREAKING — Node 18 is no longer supported.** `engines.node` moves from `>=18` to `>=22`.

  **What you must do:** on Node 22 or newer, nothing. Note npm only *warns* on an `engines` mismatch while **pnpm fails the install**, so this surfaces differently depending on your package manager. Node 18 is end-of-life and 20 is maintenance-only.

- **BREAKING — React 18 is no longer supported.** `peerDependencies.react` / `react-dom` are now `^19.0.0`.

  **What you must do:** on React 19, nothing. On React 18, stay on the previous release, or upgrade your app to 19 first.

  React 18 support was a claim nothing tested — every build and test in this package ran against 19, so the 18 half of the old range was never executed. An untested compatibility claim is worse than an absent one, because it reads as support.

### Why

These are the kit 0.5 platform floors, applied across every package at once so a consumer never has to resolve a mix. **No API changed, nothing was removed, nothing was renamed** — only what the package requires.


## [0.3.1] — 2026-07-27

### Fixed

- **`Inspector`'s labels were attached to nothing.** Every one was a plain
  sibling of its control — `<label>Background</label><input/>` — so clicking a
  label focused nothing and a screen reader announced the style panel as a
  column of unlabelled boxes.

  Worth distinguishing: `NodeInspector`'s labels **wrap** their inputs, which
  associates them implicitly and was always correct. This was seven fields in
  one file, not a package-wide defect.

  Each control now has an `id` its label points at, plus a `data-cms-field`
  handle keyed by the field — the stable identity the Human+ contract asks for,
  so an agent addresses a field by name instead of guessing at the DOM.

- **The element palette was hardcoded dark inside a light-themed host.** The
  editor ships a `--fcms-*` light/dark token layer and then set
  `background: "#0b1220"`, `color: "#e2e8f0"` and a slate border directly, so a
  host on the light theme got a permanently dark flyout. The overlay's selection
  outlines, the drop hint and several `NodeInspector` colours bypassed the layer
  the same way.

  All of them now resolve through `--fcms-*` **with the previous values as
  fallbacks**, so default rendering is unchanged and only a host that themes the
  editor sees a difference. `--fcms-drop` and `--fcms-danger` were added to the
  light and dark blocks, since a token nothing defines cannot be themed from one
  place.

  **Nothing to do.** No prop or markup changed.

### Changed

- **A stale note in `Editor.tsx` said the chrome "graduates to react-fancy
  next".** It dates from the Phase 0+1 commit and the `--fcms-*` token layer
  landed three weeks after it, superseding it — react-fancy's primitives are
  hardcoded Tailwind palette classes that read no custom properties, so adopting
  them would ignore `--fcms-accent` and strand a themed host with a half-themed
  editor. The comment now records why the chrome stays plain markup, and that
  the old plan is no longer the plan. It is the kind of note that gets acted on
  long after it stopped being true.

### Added

- **11 tests** covering label association, the field handles, per-instance ids,
  the select → deselect → reselect transition, and that every `--fcms-*` token
  referenced anywhere is actually defined. Ten of them fail against the previous
  code.

## 0.1.1 — 2026-07-06

### Fixed
- **`Editor`: the notify effect no longer depends on the `onChange` prop's
  identity** (#1). The latest `onChange` is held in a ref (synced in an effect)
  and the notify effect depends only on the document — so a consumer passing an
  inline closure that also sets state (the most natural usage) can no longer
  loop the notify (notify → setState → render → new closure identity → effect
  re-fires → notify → …; 91k fires observed for one op). Each op now notifies
  exactly once, guarded by a regression test.
- The same hygiene applied to `EditablePage`'s `onSelect` notify and
  `onProgress` scroll-reporting effects — the identical latent loop class.

## 0.1.0 — 2026-07-05

First beta. The editor (`Editor`, `EditablePage`, `Canvas`, `LayersPanel`,
inspectors, `useEditor` + snapshot undo/redo) and the isomorphic renderer
(`CmsPage`, `CmsRegion`) exported from the main entry, over the Stages document
model, the `PageOp` op-spine, and the JS style→CSS emitter (byte-parity with the
PHP emitter in `particle-academy/fancy-cms`).
