/** fancy-code's editor and viewers as kit islands; edits stay in the page. */
import type { ReactElement } from "react";
import { CodeEditor, FileViewer, MarkdownEditor } from "@particle-academy/fancy-code";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";
import { generic, useIslandState } from "../generic";

function KitCodeEditor({ props }: IslandComponentProps): ReactElement {
  const { label, ...rest } = props;
  const [value, setValue] = useIslandState<string>(rest, { value: "value", default: "defaultValue", change: "onChange" });
  delete rest.defaultValue;
  return (
    <div role="group" aria-label={typeof label === "string" ? label : "Code editor"}>
      <CodeEditor {...rest} value={value ?? ""} onChange={(v: string) => setValue(v)}>
        <CodeEditor.Panel />
      </CodeEditor>
    </div>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-code:CodeEditor": KitCodeEditor,
  "fancy-code:FileViewer": generic(FileViewer),
  "fancy-code:MarkdownEditor": generic(MarkdownEditor, { state: { value: "value", default: "defaultValue", change: "onChange" } }),
};
