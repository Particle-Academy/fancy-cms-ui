/** fancy-artboard's ArtBoard as a kit island, in a sized frame; edits stay in the page. */
import type { ReactElement } from "react";
import { ArtBoard } from "@particle-academy/fancy-artboard";
import "@particle-academy/fancy-artboard/styles.css";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";
import { generic } from "../generic";

const Inner = generic(ArtBoard, { state: { value: "value", default: "defaultValue", change: "onChange" } });

function KitArtBoard(p: IslandComponentProps): ReactElement {
  const { height, ...rest } = p.props;
  return (
    <div style={{ height: typeof height === "number" ? height : 420, width: "100%" }}>
      <Inner {...p} props={rest} />
    </div>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-artboard:ArtBoard": KitArtBoard,
};
