# @particle-academy/fancy-cms-ui

[![Fancified](art/fancified.svg)](https://particle.academy)

The editor + isomorphic renderer for **fancy-cms** — an extendable inline-WYSIWYG
website + app-shell builder for Laravel, built on the Fancy UI suite.

> **Status: Phase 0 done; Phase 1 in progress.** Ships the foundation the rest
> of the system types against — the **Stages** document model, the **`PageOp`**
> op-spine + pure `reduce`, and the **JS style→CSS emitter** (one half of the
> dual-emitter pair; the other lives in the PHP `particle-academy/fancy-cms`) —
> the **React renderer** (`./react`: `CmsPage` / `CmsRegion`) shared by the
> editor and published islands, and the **WYSIWYG editor** (`./editor`: layers ·
> canvas with select + drag-move · inspector · snapshot undo/redo). Motion
> engine, addon SDK, file manager, and the opt-in `/collab` + `/agent` layers
> land in later phases.

Architecture & plan: `fancy-ui/docs/fancy-cms.md`.

## What's here (Phase 0)

```
src/
├── document/
│   ├── types.ts      Stages model: PageDoc, Node, Constraints, StyleProps, …
│   ├── ops.ts        PageOp union + envelope
│   ├── reduce.ts     pure/total reduce(doc, op) + invert(doc, op) for undo
│   └── fractional.ts collab-safe ordering keys (keyBetween)
├── render/
│   └── css.ts        deterministic style/layout/constraints → CSS (static subset)
├── react/            the React renderer (the ./react entry)
│   ├── registry.tsx  element registry (text/image/section/stack/grid/…)
│   ├── RenderNode.tsx recursive node → DOM with data-cms handles + islands
│   └── CmsPage / CmsRegion  full page + embeddable subtree
└── editor/           the WYSIWYG editor (the ./editor entry)
    ├── state.ts      pure editor reducer (ops + snapshot undo/redo + selection)
    ├── useEditor.ts  the editor hook
    └── Editor / Canvas / LayersPanel / Inspector
```

The `reduce` function is **pure and total** (an invalid op is a logged no-op),
which is what makes undo, revisions, collaboration, and agent edits all flow
through one spine. The CSS emitter is **deterministic** so the PHP emitter can
produce byte-identical output — verified by the parity harness.

## Principles

- **Guest, not host** — adopted per-surface (route / region / slot).
- **Human+ is opt-in** — core works single-user with no websockets or agents.
- **Zero third-party runtime deps.**

MIT © Particle Academy

---

## ⭐ Star Fancy UI

If this package is useful to you, a quick ⭐ on the repo really helps us build a better kit. Thank you!
