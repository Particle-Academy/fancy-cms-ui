/** react-fancy's data and content components as islands. */
import type { ReactElement } from "react";
import { ChatThread, CodeBlock, CodeView, ContentRenderer, Editor, FileBrowser, JsonEditor, NotificationBell, NotificationInbox, Table } from "@particle-academy/react-fancy";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";
import { generic, useIslandState } from "../generic";

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));

function KitTable({ props }: IslandComponentProps): ReactElement {
  const columns = list<{ key: string; label: string }>(props.columns);
  const rows = list<Record<string, unknown>>(props.rows);
  return (
    <Table aria-label={str(props.caption)}>
      <Table.Head>
        <Table.Row>
          {columns.map((c) => (
            <Table.Column key={c.key} label={c.label} />
          ))}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map((row, i) => (
          <Table.Row key={i}>
            {columns.map((c, j) => (
              <Table.Cell key={c.key} header={j === 0}>
                {str(row[c.key])}
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function KitCodeBlock({ props }: IslandComponentProps): ReactElement {
  return <CodeBlock copyable {...(props as { code: string })} />;
}

function KitEditor({ props }: IslandComponentProps): ReactElement {
  const { label, ...rest } = props;
  const [value, setValue] = useIslandState<string>(rest, { value: "value", default: "defaultValue", change: "onChange" });
  delete rest.defaultValue;
  return (
    <Editor {...rest} aria-label={str(label) || "Editor"} outputFormat="markdown" valueFormat="markdown" value={value ?? ""} onChange={(v: string) => setValue(v)}>
      <Editor.Toolbar />
      <Editor.Content />
    </Editor>
  );
}

function KitJsonEditor({ props }: IslandComponentProps): ReactElement {
  return <JsonEditor readOnly {...(props as { value: never })} />;
}

function KitContentRenderer({ props }: IslandComponentProps): ReactElement {
  // Markdown only, never unsafe: the HTML a document may carry is none.
  return <ContentRenderer {...(props as { value: string })} format="markdown" />;
}

function KitNotificationInbox({ props }: IslandComponentProps): ReactElement {
  return <NotificationInbox {...(props as { items: never[] })} />;
}

function KitChatThread({ props }: IslandComponentProps): ReactElement {
  return <ChatThread {...(props as { messages: never[] })} />;
}

export const islands: Record<string, IslandComponent> = {
  "react-fancy:Table": KitTable,
  "react-fancy:CodeBlock": KitCodeBlock,
  "react-fancy:CodeView": generic(CodeView, { state: { value: "value", change: "onChange" }, defaults: { readOnly: true } }),
  "react-fancy:ContentRenderer": KitContentRenderer,
  "react-fancy:Editor": KitEditor,
  "react-fancy:JsonEditor": KitJsonEditor,
  "react-fancy:FileBrowser": generic(FileBrowser),
  "react-fancy:NotificationBell": generic(NotificationBell),
  "react-fancy:NotificationInbox": KitNotificationInbox,
  "react-fancy:ChatThread": KitChatThread,
};
