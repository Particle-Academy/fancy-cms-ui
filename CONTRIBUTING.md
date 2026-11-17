# Contributing to @particle-academy/fancy-cms-ui

Notes for anyone, human or agent, working ON this package's code. How to USE the
package is in [AGENTS.md](./AGENTS.md); what it is, is in [README.md](./README.md).
`CLAUDE.md` is a symlink to this file, so Claude Code reads these notes when it
works in this repo.

## Commands

```bash
npm run build        # tsup
npm test             # vitest (tests/)
npm run lint         # tsc (src + tests) and eslint
npm run parity       # the JS/PHP parity harness (parity/run.mjs)
npm run parity:wrap  # the text-wrap browser check
```

## Twins and generated data

- **The CSS emitter is one half of a pair.** The other half is the PHP emitter in
  `particle-academy/fancy-cms`, and the two must produce byte-identical output.
  The parity harness (`parity/`, canonical documents in `parity/*.json`) verifies
  it. A change to the emitter, the renderer or a canonical document lands in both
  repos.
- **Icons are generated.** `npm run icons:generate` regenerates both workspace
  twins from the Lucide artifact resolved by the installed react-fancy.
  `npm run icons:check` is the offline release check (source version and range,
  content SHA-256, PHP/JS data and licence must match); `npm run icons:check:pair`
  also requires the PHP twin checkout. Regenerate after changing Fancy's Lucide
  version. See `NOTICE`, `licenses/LUCIDE-LICENSE` and `icons/metadata.json`.
  `npm run icons:bundle` checks the icon bundle.
- **The `./kit` island catalogue is generated** from the components' real prop
  types: `npm run kit:generate`; `npm run kit:check` (and the suite) fails on
  drift. Its PHP twin, `IslandCatalogue::kit()`, must stay byte-identical.

## Invariants stated in the README

- `reduce` is **pure and total**: an invalid op is a logged no-op. Undo,
  revisions, collaboration and agent edits all flow through it.
- **Zero third-party runtime dependencies.** `@particle-academy/react-fancy` and
  `@particle-academy/fancy-echarts` are optional peers.
- The main, React and editor entries include the closed icon name index and no
  glyph catalogue, and no runtime react-fancy import.

## Changelog

Update `CHANGELOG.md` in the same commit as the change.
