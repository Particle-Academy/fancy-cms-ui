/**
 * fancy-walkthrough as a kit island: a button starts a tour whose steps point
 * at nodes of this page by their `data-cms` id. No target is wrapped: each is
 * registered from the DOM the CMS already rendered.
 */
import { useEffect, type ReactElement } from "react";
import { Button } from "@particle-academy/react-fancy";
import { Walkthrough, useWalkthrough, useWalkthroughTarget } from "@particle-academy/fancy-walkthrough";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";

type Step = { target: string; title: string; body?: string };
const NODE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function Target({ id }: { id: string }): null {
  const ref = useWalkthroughTarget(id);
  useEffect(() => {
    const el = typeof document !== "undefined" && NODE_ID.test(id) ? document.querySelector<HTMLElement>(`[data-cms="${id}"]`) : null;
    ref(el);
    return () => ref(null);
  }, [id, ref]);
  return null;
}

function Start({ label }: { label: string }): ReactElement {
  const { start } = useWalkthrough();
  return <Button onClick={() => start()}>{label}</Button>;
}

function KitWalkthrough({ props, node }: IslandComponentProps): ReactElement {
  const steps = (Array.isArray(props.steps) ? (props.steps as Step[]) : []).filter((s) => s && typeof s.target === "string" && typeof s.title === "string");
  return (
    <Walkthrough id={`cms-${node.id}`} steps={steps.map((s, i) => ({ id: `s${i}`, target: s.target, title: s.title, body: s.body }))} storage={null}>
      {[...new Set(steps.map((s) => s.target))].map((t) => (
        <Target key={t} id={t} />
      ))}
      <Start label={typeof props.label === "string" ? props.label : "Take the tour"} />
    </Walkthrough>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-walkthrough:Walkthrough": KitWalkthrough,
};
