/** New icons use the existing op spine; this fixture contains no SVG data. */
export function iconCases(base) {
  const node = { id: "icon", type: "icon", parent: "a", order: "V", props: { name: "receipt-text", decorative: true }, style: { base: {} } };
  return [
    { name: "icon-label-undo-and-style", doc: base, ops: [
      { t: "insert_node", node },
      { t: "set_node_props", id: "icon", patch: { name: "calculator", decorative: false, label: 'Tax <estimate> & "quarter"' } },
      { t: "set_style", id: "icon", breakpoint: "base", patch: { fontSize: { value: 24, unit: "px" }, color: "var(--cms-color-primary)" } },
      { t: "set_node_props", id: "icon", patch: { decorative: true } },
      { t: "remove_node", id: "icon" },
    ] },
    { name: "icon-invalid-props-and-children", doc: base, ops: [
      { t: "insert_node", node },
      ...[{ name: "__proto__" }, { name: "constructor" }, { name: "toString" }, { name: "unknown" }, { name: { $bind: "icon" } },
        { decorative: "true" }, { decorative: null }, { decorative: false }, { decorative: false, label: " " }, { label: 1 }, { path: "M0 0" }, { svg: "<svg/>" }]
        .flatMap((patch, index) => [
          { t: "set_node_props", id: "icon", patch },
          { t: "insert_node", node: { ...node, id: `bad-${index}`, props: { ...node.props, ...patch } } },
        ]),
      { t: "insert_node", node: { ...node, id: "bad-child", parent: "icon" } },
      { t: "move_node", id: "b", parent: "icon", order: "V" },
    ] },
  ];
}
