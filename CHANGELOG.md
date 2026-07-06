# Changelog

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
