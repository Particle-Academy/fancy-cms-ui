import { describe, expect, it } from "vitest";
import { fractionalKey } from "@particle-academy/fancy-doc-commons";

/**
 * Ordering compatibility with the keys already in saved documents.
 *
 * This started as a parity test between this package's own `fractional.ts` and
 * `fancy-doc-commons`, run to prove that deleting our copy was safe. The copy is
 * now gone, so comparing the two implementations would compare doc-commons with
 * itself. What still needs guarding is the thing the delete put at risk:
 *
 * **Every order key in every saved CMS document was minted by the deleted
 * implementation.** A document is not re-keyed on load — old keys and new keys
 * sit in the same `nodes` map and have to sort against each other forever. So
 * doc-commons is not merely required to be *a* fractional indexer; it has to
 * keep producing the exact keys the old one did, or a stored page silently
 * reorders itself the next time somebody inserts a block.
 *
 * The values below are GOLDEN: captured by running the deleted implementation
 * out of git history (`git show HEAD~:src/document/fractional.ts`), not derived
 * from doc-commons. Regenerating them from the current code would make this test
 * pass by construction and assert nothing.
 */
describe("ordering compatibility with legacy CMS keys", () => {
    // [before, after, the key the OLD implementation returned]
    const golden: [string | null, string | null, string][] = [
        [null, null, "V"],
        ["a0", null, "a0V"],
        [null, "a0", "I"],
        ["a0", "a1", "a0V"],
        ["a0", "a0V", "a0F"],
        ["Zz", "a0", "ZzV"],
        ["a0000", "a0001", "a0000V"],
    ];

    it.each(golden)("mints the legacy key between (%s, %s)", (a, b, expected) => {
        expect(fractionalKey(a, b)).toBe(expected);
    });

    it("matches the legacy implementation across a 200-step insert walk", () => {
        // Repeated insertion between neighbours is where precision-extension
        // logic diverges if it is going to — a single-call comparison misses it
        // entirely. These three prefixes and the final key are the old
        // implementation's actual output for the same walk.
        let a = "a0";
        let b = "a1";
        const walk: string[] = [];

        for (let i = 0; i < 200; i++) {
            const c = fractionalKey(a, b);
            walk.push(c);
            b = c;
        }

        expect(walk.slice(0, 3)).toEqual(["a0V", "a0F", "a07"]);
        expect(walk[199]).toBe("a00000000000000000000000000000000000000001");
    });

    it("keeps legacy and freshly-minted keys sorting together", () => {
        // The failure this whole file exists to catch, stated directly: a key
        // generated today has to land between two keys generated a year ago.
        const legacy = ["a0", "a1", "a2"];
        const inserted = fractionalKey("a0", "a1");
        const sorted = [...legacy, inserted].sort();

        expect(sorted).toEqual(["a0", inserted, "a1", "a2"]);
    });
});
