/** react-fancy's layout and sequence components as islands. */
import { useState, type ReactElement } from "react";
import {
  Container,
  FauxClient,
  Grid,
  IndexList,
  Kanban,
  ReorderableGrid,
  ResizablePanels,
  Section,
  SetupWizard,
  Stepper,
  TimeGrid,
  Timeline,
  VirtualList,
} from "@particle-academy/react-fancy";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";
import { generic, useIslandState } from "../generic";

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function KitReorderableGrid({ props }: IslandComponentProps): ReactElement {
  const { items, ...rest } = props;
  const tiles = list<{ id: string; label: string }>(items);
  const [order, setOrder] = useIslandState<string[]>(rest, { value: "value", default: "defaultValue", change: "onReorder" });
  delete rest.defaultValue;
  return (
    <ReorderableGrid
      {...rest}
      items={tiles}
      value={order ?? tiles.map((t) => t.id)}
      onReorder={(next: string[]) => setOrder(next)}
      getItemLabel={(t) => String((t as { label?: unknown }).label ?? t.id)}
      renderItem={(t) => <span>{String((t as { label?: unknown }).label ?? t.id)}</span>}
    />
  );
}

function KitVirtualList({ props }: IslandComponentProps): ReactElement {
  const { items, ...rest } = props;
  return <VirtualList {...rest} height={typeof rest.height === "number" ? rest.height : 320} items={list<{ id: string; text: string }>(items)} renderRow={(row) => <div>{String((row as { text?: unknown }).text ?? "")}</div>} />;
}

function KitStepper({ props }: IslandComponentProps): ReactElement {
  const { steps, label, ...rest } = props;
  const [current, setCurrent] = useIslandState<number>(rest, { value: "current", default: "defaultCurrent", change: "onChange" });
  delete rest.defaultCurrent;
  const data = list<{ id: string; title: string; description?: string; content?: string }>(steps).map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    content: s.content ? <p>{s.content}</p> : undefined,
  }));
  return <Stepper {...rest} aria-label={typeof label === "string" ? label : "Steps"} steps={data} current={current ?? 0} onChange={(i: number) => setCurrent(i)} />;
}

function KitKanban({ props }: IslandComponentProps): ReactElement {
  type Card = { id: string; text: string };
  type Column = { id: string; title: string; cards: Card[] };
  const [columns, setColumns] = useState<Column[]>(() => list<Column>(props.columns).map((c) => ({ ...c, cards: list<Card>(c.cards) })));
  const move = (cardId: string, from: string, to: string, toIndex?: number) => {
    setColumns((cols) => {
      const card = cols.find((c) => c.id === from)?.cards.find((k) => k.id === cardId);
      if (!card) return cols;
      return cols.map((c) => {
        let cards = c.cards.filter((k) => k.id !== cardId);
        if (c.id === to) {
          const at = typeof toIndex === "number" ? Math.min(Math.max(toIndex, 0), cards.length) : cards.length;
          cards = [...cards.slice(0, at), card, ...cards.slice(at)];
        }
        return { ...c, cards };
      });
    });
  };
  return (
    <Kanban onCardMove={move}>
      {columns.map((col) => (
        <Kanban.Column key={col.id} id={col.id} title={col.title}>
          {col.cards.map((card) => (
            <Kanban.Card key={card.id} id={card.id}>
              {card.text}
            </Kanban.Card>
          ))}
        </Kanban.Column>
      ))}
    </Kanban>
  );
}

function KitSetupWizard({ props }: IslandComponentProps): ReactElement {
  const [value, setValue] = useIslandState<{ current: number; done: number[] }>(props, { value: "value", change: "onChange" });
  return <SetupWizard {...(props as { steps: never[] })} value={value ?? { current: 0, done: [] }} onChange={(v: { current: number; done: number[] }) => setValue(v)} />;
}

export const islands: Record<string, IslandComponent> = {
  "react-fancy:Container": generic(Container, { children: "slot" }),
  "react-fancy:Section": generic(Section, { children: "slot" }),
  "react-fancy:Grid": generic(Grid, { children: "slot" }),
  "react-fancy:FauxClient": generic(FauxClient, { children: "slot" }),
  "react-fancy:ResizablePanels": generic(ResizablePanels, { children: "slot", state: { value: "value", default: "defaultValue", change: "onValueChange" } }),
  "react-fancy:ReorderableGrid": KitReorderableGrid,
  "react-fancy:VirtualList": KitVirtualList,
  "react-fancy:IndexList": generic(IndexList),
  "react-fancy:Timeline": generic(Timeline),
  "react-fancy:Stepper": KitStepper,
  "react-fancy:TimeGrid": generic(TimeGrid, { state: { value: "value", change: "onChange" } }),
  "react-fancy:SetupWizard": KitSetupWizard,
  "react-fancy:Kanban": KitKanban,
};
