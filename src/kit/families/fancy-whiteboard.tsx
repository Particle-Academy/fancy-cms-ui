/**
 * fancy-whiteboard's Board as one island: shapes, sticky notes and connectors
 * are JSON items, and edits stay in the page.
 */
import { useState, type ReactElement } from "react";
import { Board, Connector, Shape, StickyNote } from "@particle-academy/fancy-whiteboard";
import "@particle-academy/fancy-whiteboard/styles.css";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";

type Item = { id: string } & Record<string, unknown>;
const items = (v: unknown): Item[] => (Array.isArray(v) ? (v as Item[]).filter((i) => i && typeof i.id === "string") : []);

function KitBoard({ props }: IslandComponentProps): ReactElement {
  const [notes, setNotes] = useState(() => items(props.notes));
  const [shapes, setShapes] = useState(() => items(props.shapes));
  const connectors = Array.isArray(props.connectors) ? (props.connectors as { from: { x: number; y: number }; to: { x: number; y: number }; color?: string; dashed?: boolean }[]) : [];
  const height = typeof props.height === "number" ? props.height : 420;
  const replace = (set: typeof setNotes) => (next: Item) => set((all) => all.map((x) => (x.id === next.id ? next : x)));
  return (
    <div role="group" aria-label={typeof props.label === "string" ? props.label : "Whiteboard"}>
      <Board minZoom={typeof props.minZoom === "number" ? props.minZoom : undefined} maxZoom={typeof props.maxZoom === "number" ? props.maxZoom : undefined} style={{ width: "100%", height }}>
        {connectors.map((c, i) => (
          <Connector key={`c${i}`} from={c.from} to={c.to} color={c.color} dashed={c.dashed} />
        ))}
        {shapes.map((s) => (
          <Shape key={s.id} item={s as never} onChange={replace(setShapes) as never} />
        ))}
        {notes.map((n) => (
          <StickyNote key={n.id} item={n as never} onChange={replace(setNotes) as never} />
        ))}
      </Board>
    </div>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-whiteboard:Board": KitBoard,
};
