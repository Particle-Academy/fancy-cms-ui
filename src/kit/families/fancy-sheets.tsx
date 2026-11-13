/** fancy-sheets as kit islands. The grid fills its container, so each island is a sized frame. */
import type { ReactElement } from "react";
import { Sheet, Spreadsheet, WorkbookFileView } from "@particle-academy/fancy-sheets";
import "@particle-academy/fancy-sheets/styles.css";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";
import { generic, useIslandState } from "../generic";

function KitSpreadsheet({ props }: IslandComponentProps): ReactElement {
  const [data, setData] = useIslandState<unknown>(props, { value: "data", default: "defaultData", change: "onChange" });
  const rest = { ...props };
  delete rest.defaultData;
  return (
    <div style={{ height: 420, width: "100%" }}>
      <Spreadsheet {...rest} {...(data === undefined ? {} : { data: data as never })} onChange={(d: unknown) => setData(d)}>
        <Spreadsheet.Toolbar />
        <Spreadsheet.Grid />
        <Spreadsheet.SheetTabs />
      </Spreadsheet>
    </div>
  );
}

const SheetIsland = generic(Sheet, { state: { value: "data", change: "onChange" } });
function KitSheet(p: IslandComponentProps): ReactElement {
  return (
    <div style={{ height: 360, width: "100%" }}>
      <SheetIsland {...p} />
    </div>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-sheets:Spreadsheet": KitSpreadsheet,
  "fancy-sheets:Sheet": KitSheet,
  "fancy-sheets:WorkbookFileView": generic(WorkbookFileView),
};
