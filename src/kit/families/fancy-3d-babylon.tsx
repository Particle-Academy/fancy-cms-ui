/**
 * fancy-3d-babylon's Stage as a kit island: a WebGL scene of Monitors, each showing
 * text as a DOM overlay mapped onto its screen. The scene itself is decorative;
 * the monitors' text is the content, in the server fallback too.
 */
import type { ReactElement } from "react";
import { Monitor, Stage } from "@particle-academy/fancy-3d-babylon/react";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";

type M = { position: [number, number, number]; width: number; height: number; rotationY?: number; text: string };

function KitStage({ props }: IslandComponentProps): ReactElement {
  const monitors = (Array.isArray(props.monitors) ? (props.monitors as M[]) : []).filter((m) => m && Array.isArray(m.position) && m.position.length === 3);
  const height = typeof props.height === "number" ? props.height : 420;
  return (
    <div role="group" aria-label={typeof props.label === "string" ? props.label : "3D scene"}>
      <Stage style={{ height, width: "100%" }}>
        {monitors.map((m, i) => (
          <Monitor key={i} position={m.position} width={m.width} height={m.height} rotationY={m.rotationY}>
            <div style={{ padding: 16, fontSize: 18, color: "#0f172a", background: "#ffffff", height: "100%" }}>{m.text}</div>
          </Monitor>
        ))}
      </Stage>
    </div>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-3d-babylon:Stage": KitStage,
};
