/** fancy-term's Terminal as a read-only transcript island (a live shell needs fancy-term-host). */
import type { ReactElement } from "react";
import { Terminal } from "@particle-academy/fancy-term";
import "@particle-academy/fancy-term/xterm.css";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";

function KitTerminal({ props }: IslandComponentProps): ReactElement {
  const { label, ...rest } = props;
  return (
    <div role="group" aria-label={typeof label === "string" ? label : "Terminal"} style={{ height: 320, width: "100%" }}>
      <Terminal fit {...rest} readOnly />
    </div>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-term:Terminal": KitTerminal,
};
