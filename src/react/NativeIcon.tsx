import { createElement } from "react";
import { iconGlyph, validIconProps, type IconSet } from "../document/icons";

/** Fixed Fancy Icon-compatible wrapper; no runtime react-fancy peer required. */
export function NativeIcon({ props, icons }: { props: unknown; icons?: IconSet }) {
  if (!validIconProps(props)) return null;
  const glyph = iconGlyph(props.name, icons);
  if (!glyph) return null;
  return (
    <span aria-hidden="true" data-react-fancy-icon="" className="inline-flex items-center justify-center flex-shrink-0 h-5 w-5"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: "1em", height: "1em", verticalAlign: "middle" }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {glyph.map(([tag, attrs], index) => createElement(tag, { ...attrs, key: index }))}
      </svg>
    </span>
  );
}
