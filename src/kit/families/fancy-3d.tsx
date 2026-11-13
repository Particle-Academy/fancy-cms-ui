/** fancy-3d's Canvas (DOM engine, no WebGL) as a kit island: nodes of text and the edges between them. */
import type { ReactElement } from "react";
import { Canvas } from "@particle-academy/fancy-3d/canvas";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";

type N = { id: string; x: number; y: number; text: string };
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function KitCanvas({ props }: IslandComponentProps): ReactElement {
  const nodes = list<N>(props.nodes).filter((n) => n && typeof n.id === "string");
  const edges = list<{ from: string; to: string }>(props.edges);
  const height = typeof props.height === "number" ? props.height : 360;
  return (
    <div role="group" aria-label={typeof props.label === "string" ? props.label : "Canvas"} style={{ height, width: "100%" }}>
      <Canvas engine="dom" showGrid={props.showGrid !== false} fitOnMount style={{ width: "100%", height: "100%" }}>
        {nodes.map((n) => (
          <Canvas.Node key={n.id} id={n.id} x={n.x} y={n.y} style={{ minWidth: 140, padding: 12, border: "1px solid currentColor", borderRadius: 8, background: "var(--cms-color-surface, #fff)" }}>
            {n.text}
          </Canvas.Node>
        ))}
        {edges.map((e, i) => (
          <Canvas.Edge key={i} from={e.from} to={e.to} />
        ))}
      </Canvas>
    </div>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-3d:Canvas": KitCanvas,
};
