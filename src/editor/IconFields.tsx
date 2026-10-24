import { useId, type CSSProperties } from "react";
import { iconNames } from "../document/icons";

const field: CSSProperties = { display: "block", margin: "8px 0", fontSize: 12 };
const control: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "6px 8px", color: "inherit", background: "var(--fcms-input-bg, transparent)", border: "1px solid var(--fcms-border, #94a3b8)", borderRadius: 6 };

/** Both authoring surfaces use the same controlled, bounded icon controls. */
export function IconFields({ props, onChange }: { props: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  const uid = useId();
  const label = typeof props.label === "string" ? props.label : "";
  const decorative = props.decorative !== false;
  return <>
    <label style={field} htmlFor={`${uid}-name`}>Icon</label>
    <select id={`${uid}-name`} data-cms-field="icon-name" style={control} value={typeof props.name === "string" ? props.name : ""}
      onChange={(event) => onChange({ name: event.target.value })}>
      {iconNames().map((name) => <option key={name} value={name}>{name}</option>)}
    </select>
    <label style={field} htmlFor={`${uid}-label`}>Accessible label</label>
    <input id={`${uid}-label`} data-cms-field="icon-label" style={control} value={label} maxLength={256}
      onChange={(event) => onChange({ label: event.target.value, ...(!/[^\x09-\x0D ]/u.test(event.target.value) ? { decorative: true } : {}) })} />
    <label style={field} htmlFor={`${uid}-decorative`}>
      <input id={`${uid}-decorative`} data-cms-field="icon-decorative" type="checkbox" checked={decorative}
        disabled={decorative && !/[^\x09-\x0D ]/u.test(label)} onChange={(event) => onChange({ decorative: event.target.checked })} /> Decorative
    </label>
    <p style={{ ...field, opacity: 0.8 }}>Leave the label empty for decorative icons.</p>
  </>;
}
