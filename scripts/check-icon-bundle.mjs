/** Measure the public exports and assert that a three-icon page reaches only three glyphs. */
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { build } = createRequire(require.resolve('tsup'))('esbuild');
const header = `import {createElement} from 'react'; import {CmsPage} from '@particle-academy/fancy-cms-ui/react';`;
const sources = {
  core: `${header} export const Page=({doc})=>createElement(CmsPage,{doc});`,
  three: `${header} import fileText from '@particle-academy/fancy-cms-ui/icons/file-text'; import receiptText from '@particle-academy/fancy-cms-ui/icons/receipt-text'; import calculator from '@particle-academy/fancy-cms-ui/icons/calculator'; const icons={'file-text':fileText,'receipt-text':receiptText,calculator}; export const Page=({doc})=>createElement(CmsPage,{doc,icons});`,
  all: `${header} import icons from '@particle-academy/fancy-cms-ui/icons/all'; export const Page=({doc})=>createElement(CmsPage,{doc,icons});`,
};
const report = {};
for (const [label, contents] of Object.entries(sources)) {
  const result = await build({ stdin: { contents, resolveDir: root }, bundle: true, write: false, minify: true, format: 'esm', platform: 'browser', external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'], metafile: true });
  const output = result.outputFiles[0].contents;
  const inputs = Object.keys(result.metafile.inputs).map(path => path.replaceAll('\\', '/'));
  const glyphs = inputs.filter(path => /(?:^|\/)icons\/.*\.js$/.test(path));
  if (label === 'three') assert.deepEqual(glyphs.map(path => path.split('/').at(-1)).sort(), ['calculator.js', 'file-text.js', 'receipt-text.js']);
  if (label === 'core') assert.equal(glyphs.length, 0);
  if (label !== 'all') assert.ok(!inputs.some(path => /lucide-react|@particle-academy\/react-fancy/.test(path)), 'No runtime Fancy/Lucide dependency');
  report[label] = { rawBytes: output.length, gzipBytes: gzipSync(output, { level: 9 }).length, glyphModules: glyphs.length };
}
report.threeGlyphDelta = { rawBytes: report.three.rawBytes - report.core.rawBytes, gzipBytes: report.three.gzipBytes - report.core.gzipBytes };
assert.ok(report.three.gzipBytes < 24000, 'Three-icon renderer exceeded 24 KB gzip');
assert.deepEqual(require('@particle-academy/fancy-cms-ui/icons/file-text'), (await import('../icons/file-text.js')).default);
const cjs = await require('@particle-academy/fancy-cms-ui/icons').loadIcons(['file-text', 'home', 'house']);
assert.deepEqual(cjs['file-text'], require('@particle-academy/fancy-cms-ui/icons/file-text'));
assert.equal(cjs.home, cjs.house);
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
