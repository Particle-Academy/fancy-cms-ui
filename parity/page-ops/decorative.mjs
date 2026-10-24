export function decorativeCases(base) {
  const node = (id, type = "frame", parent = "a", props = {}) => ({ id, type, parent, order: "V", props, style: { base: {} } });
  return [
    { name: "decorative-safe-wire-undo", doc: base, ops: [
      { t: "insert_node", node: node("art") },
      { t: "insert_node", node: node("shape", "shape", "art") },
      { t: "set_node_props", id: "art", patch: { decorative: true } },
      { t: "insert_node", node: node("nested", "frame", "shape", { decorative: false }) },
      { t: "set_node_props", id: "art", patch: { decorative: false } },
      { t: "set_node_props", id: "art", patch: { decorative: true } },
      { t: "move_node", id: "shape", parent: "a", order: "Z" },
    ] },
    { name: "decorative-refusals", doc: base, ops: [
      { t: "insert_node", node: node("art", "frame", "a", { decorative: true }) },
      { t: "insert_node", node: node("nested", "shape", "art") },
      { t: "set_action", id: "nested", index: 0, action: { on: "click", do: { kind: "navigate", href: "/signup" } } },
      { t: "insert_node", node: { ...node("active", "shape", "art"), actions: [{ on: "click", do: { kind: "navigate", href: "/signup" } }] } },
      ...["text", "heading", "richtext", "link", "button", "list", "image", "callout", "code", "card", "stack", "repeater"].map((type) => ({ t: "insert_node", node: node(`bad-${type}`, type, "nested", { content: "Must stay visible", alt: "Image" }) })),
      { t: "move_node", id: "child", parent: "nested", order: "V" },
      { t: "insert_node", node: node("link", "link", "a", { href: "/pricing", content: "Pricing" }) },
      { t: "set_node_props", id: "link", patch: { decorative: true } },
      { t: "set_node_props", id: "link", patch: { decorative: false } },
      ...["true", null, 1, { $bind: "hidden" }].map((decorative) => ({ t: "set_node_props", id: "art", patch: { decorative } })),
      { t: "insert_node", node: node("group") },
      { t: "insert_node", node: node("cta", "button", "group", { label: "Trial", href: "/signup" }) },
      { t: "set_node_props", id: "group", patch: { decorative: true } },
      { t: "move_node", id: "group", parent: "art", order: "V" },
    ] },
    { name: "decorative-prototype-handles", doc: base, ops: [
      { t: "insert_node", node: node("__proto__", "frame", "a", { decorative: true }) },
      { t: "insert_node", node: node("constructor", "shape", "__proto__") },
      { t: "insert_node", node: node("toString", "heading", "constructor", { content: "Heading" }) },
      { t: "set_node_props", id: "constructor", patch: { decorative: true } },
    ] },
  ];
}
