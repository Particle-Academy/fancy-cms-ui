/**
 * The input island's browser module: page inputs drawn with react-fancy, loaded
 * only by `import("../islands/inputs")` from the island registry, so a page
 * without an input never fetches it and the renderer stays free of
 * react-fancy (an optional peer).
 *
 * Every control keeps the element ids the server markup used
 * (`cms-input-<name>`, `-from`, `-to`), so a label, a test or an agent that
 * found a control before the swap still finds it after.
 */
import type { ReactElement } from "react";
import { CheckboxGroup, DatePicker, Select } from "@particle-academy/react-fancy";
import type { InputControlProps } from "../react/inputs";
import type { DateRange } from "../render/inputs";

export default function InputControl({ model, onChange }: InputControlProps): ReactElement {
  const id = `cms-input-${model.name}`;
  if (model.kind === "multiselect") {
    return (
      <fieldset>
        <legend>{model.label}</legend>
        <CheckboxGroup name={`${model.name}[]`} list={model.options} value={model.value as string[]} onValueChange={(v) => onChange(model.options.filter((o) => v.includes(o.value)).map((o) => o.value))} orientation="horizontal" />
      </fieldset>
    );
  }
  if (model.kind === "daterange") {
    const range = model.value as DateRange;
    return (
      <fieldset>
        <legend>{model.label}</legend>
        <DatePicker id={`${id}-from`} name={`${model.name}[from]`} label={model.fromLabel} value={range.from} max={range.to || undefined} onValueChange={(from: string) => onChange({ from, to: range.to })} />
        <DatePicker id={`${id}-to`} name={`${model.name}[to]`} label={model.toLabel} value={range.to} min={range.from || undefined} onValueChange={(to: string) => onChange({ from: range.from, to })} />
      </fieldset>
    );
  }
  return <Select id={id} name={model.name} label={model.label} list={model.options} value={model.value as string} onValueChange={(v: string) => onChange(v)} />;
}
