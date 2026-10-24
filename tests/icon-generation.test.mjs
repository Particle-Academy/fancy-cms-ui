import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createArtifacts, verifyArtifacts } from '../scripts/generate-icons.mjs';

describe('closed catalogue provenance and drift', () => {
  it('matches both packages and refuses a changed glyph, licence or installed source version', async () => {
    const artifacts = await createArtifacts();
    await expect(verifyArtifacts(artifacts)).resolves.toBeUndefined();
    for (const suffix of ['/icons/check.js', '/licenses/LUCIDE-LICENSE']) {
      await expect(verifyArtifacts(artifacts, async path => {
        const contents = await readFile(path, 'utf8');
        return path.endsWith(suffix) ? `${contents}\n// drift` : contents;
      })).rejects.toThrow('Icon artifact drift');
    }
    // Simulate the installed provider moving while the checked-in bytes stay old.
    const movedSource = await createArtifacts({ lucideVersion: '0.512.0' });
    await expect(verifyArtifacts(movedSource)).rejects.toThrow('Icon artifact drift');
  }, 30000);
});
