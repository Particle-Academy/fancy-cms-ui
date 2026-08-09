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
