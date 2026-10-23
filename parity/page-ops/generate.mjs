/** First-party xorshift corpus. The seed is part of the committed contract. */
export const SEED = 0x5eedc0de;
export function generate(base) {
  let state = SEED;
  const next = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return state >>> 0;
  };
  const pick = (items) => items[next() % items.length];
  const cases = [];
  for (let c = 0; c < 16; c++) {
    const ops = [];
    for (let i = 0; i < 64; i++) {
      const id = pick(["a", "b", "c", "child", "grandchild", "missing", "n0", "n1", "n2"]);
      const index = next() % 13;
      const patch = { value: next() % 100, empty: {}, list: [], nullable: null };
      let op;
      switch (index) {
        case 0: op = { t: "insert_node", node: { id: `n${next() % 3}`, type: "text", parent: pick([null, "a", "b", "missing"]), order: pick(["A", "V", "VV", "z"]), props: patch, style: { base: {} } } }; break;
        case 1: op = { t: "remove_node", id }; break;
        case 2: op = { t: "move_node", id, parent: pick([null, "a", "child", "grandchild", "missing"]), order: pick(["V", "VV", "z"]) }; break;
        case 3: op = { t: "set_node_props", id, patch }; break;
        case 4: op = { t: "set_layout", id, ...(next() % 3 ? { layout: pick(["free", "stack", "grid"]) } : {}) }; break;
        case 5: op = { t: "set_style", id, breakpoint: pick(["base", "md", "lg", "custom"]), patch: { color: pick([null, "red", "#123"]), opacity: (next() % 100) / 100 } }; break;
        case 6: op = { t: "set_constraints", id, breakpoint: pick(["base", "md"]), patch: { left: null, width: pick(["hug", "fill"]) } }; break;
        case 7: op = { t: "set_animation", id, anim: { id: `anim${next() % 3}`, driver: pick(["enter", "scroll", "loop"]), keyframes: [{ at: 0, props: { opacity: 0 } }, { at: 1, props: { opacity: 1 } }] } }; break;
        case 8: op = { t: "remove_animation", id, animId: `anim${next() % 3}` }; break;
        case 9: op = { t: "set_action", id, index: pick([-1, 0, 0.5, 1, 99]), action: next() % 3 ? { on: "click", do: { kind: "navigate", href: `/${next() % 10}` } } : null }; break;
        case 10: op = { t: "set_meta", patch: { title: `Seed ${c}/${i} é 😀`, seo: { description: "unchanged wire / \"quotes\"" } } }; break;
        case 11: op = { t: "set_theme", patch: { color: { accent: `#${(next() % 4096).toString(16)}` }, empty: {}, list: [] } }; break;
        default: op = { t: "reorder_roots", order: pick([["a", "b", "c"], ["c", "a", "b"], ["a", "a", "a"], []]) };
      }
      ops.push(op);
    }
    cases.push({ name: `seed-${SEED.toString(16)}-${c}`, doc: structuredClone(base), ops });
  }
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const keys = [[null, null], ["V", null], [null, "V"], ["A", "B"], ["Az", "B"], ["A0", "A1"], ["z", "A"], ["A", "A"]];
  for (let i = 0; i < 512; i++) {
    const make = () => Array.from({ length: 1 + next() % 12 }, () => alphabet[next() % alphabet.length]).join("");
    const a = make(), b = make();
    keys.push(next() % 4 === 0 ? [a, null] : a < b ? [a, b] : [b, a]);
  }
  return { cases, keys };
}
