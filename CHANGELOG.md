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
