/**
 * react-fancy's inputs as islands. Every one keeps its value as island state
 * (controlled, as the component contract asks), so a page can carry a working
 * control with no code of its own. Nothing here submits anywhere: a submitting
 * form is a host island (the lab host's kit:Form).
 */
import type { ReactElement } from "react";
import {
  Autocomplete,
  Button,
  Checkbox,
  CheckboxGroup,
  ColorPicker,
  DatePicker,
  DisplayValue,
  EmojiSelect,
  FileUpload,
  HotkeyCapture,
  Input,
  MultiSwitch,
  NumberField,
  OtpInput,
  PhoneInput,
  Pillbox,
  RadioGroup,
  Select,
  Slider,
  Switch,
  Textarea,
  TimePicker,
} from "@particle-academy/react-fancy";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";
import { generic, useIslandState } from "../generic";

const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

/** A control without a label prop of its own gets its accessible name from `label`. */
function labelled(Component: Parameters<typeof generic>[0], change: string, def?: string): IslandComponent {
  function Labelled({ props }: IslandComponentProps): ReactElement {
    const { label, ...rest } = props;
    const [value, setValue] = useIslandState<unknown>(props, { value: "value", default: def, change });
    if (def) delete rest[def];
    const extra = { [change]: (v: unknown) => setValue(v) };
    return <Component {...rest} value={value} {...extra} aria-label={str(label)} />;
  }
  return Labelled;
}

function KitFileUpload({ props }: IslandComponentProps): ReactElement {
  const { label, ...rest } = props;
  return (
    <FileUpload {...rest}>
      <FileUpload.Dropzone browseLabel={str(label)}>{str(label)}</FileUpload.Dropzone>
      <FileUpload.List />
    </FileUpload>
  );
}

export const islands: Record<string, IslandComponent> = {
  "react-fancy:Button": generic(Button, { children: "text" }),
  "react-fancy:Input": generic(Input, { state: { value: "value", change: "onValueChange" } }),
  "react-fancy:Textarea": generic(Textarea, { state: { value: "value", change: "onValueChange" } }),
  "react-fancy:Select": generic(Select, { state: { value: "value", change: "onValueChange" } }),
  "react-fancy:Checkbox": generic(Checkbox, { state: { value: "checked", default: "defaultChecked", change: "onCheckedChange" } }),
  "react-fancy:CheckboxGroup": generic(CheckboxGroup, { state: { value: "value", default: "defaultValue", change: "onValueChange" } }),
  "react-fancy:RadioGroup": generic(RadioGroup, { state: { value: "value", default: "defaultValue", change: "onValueChange" } }),
  "react-fancy:Switch": generic(Switch, { state: { value: "checked", default: "defaultChecked", change: "onCheckedChange" } }),
  "react-fancy:Slider": generic(Slider, { state: { value: "value", default: "defaultValue", change: "onValueChange" } }),
  "react-fancy:NumberField": generic(NumberField, { state: { value: "value", default: "defaultValue", change: "onValueChange" } }),
  "react-fancy:MultiSwitch": generic(MultiSwitch, { state: { value: "value", default: "defaultValue", change: "onValueChange" } }),
  "react-fancy:DatePicker": generic(DatePicker, { state: { value: "value", default: "defaultValue", change: "onValueChange" } }),
  "react-fancy:TimePicker": labelled(TimePicker, "onChange", "defaultValue"),
  "react-fancy:ColorPicker": labelled(ColorPicker, "onChange", "defaultValue"),
  "react-fancy:Autocomplete": labelled(Autocomplete, "onChange", "defaultValue"),
  "react-fancy:Pillbox": generic(Pillbox, { state: { value: "value", default: "defaultValue", change: "onChange" } }),
  "react-fancy:OtpInput": generic(OtpInput, { state: { value: "value", change: "onChange" } }),
  "react-fancy:PhoneInput": generic(PhoneInput, { state: { value: "value", default: "defaultValue", change: "onValueChange" } }),
  "react-fancy:HotkeyCapture": generic(HotkeyCapture, { state: { value: "value", default: "defaultValue", change: "onChange" } }),
  "react-fancy:EmojiSelect": labelled(EmojiSelect, "onChange", "defaultValue"),
  "react-fancy:FileUpload": KitFileUpload,
  "react-fancy:DisplayValue": generic(DisplayValue, { children: "text" }),
};
