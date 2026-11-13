/**
 * fancy-whats-new as a kit island: the features are JSON, turned into the one
 * group its loader returns, and a button opens it. Nothing is fetched.
 */
import { useMemo, useState, type ReactElement } from "react";
import { Button } from "@particle-academy/react-fancy";
import { WhatsNew } from "@particle-academy/fancy-whats-new";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";

type Feature = { id: string; title: string; body?: string; image?: string };

function KitWhatsNew({ props, node }: IslandComponentProps): ReactElement {
  const features = Array.isArray(props.features) ? (props.features as Feature[]).filter((f) => f && typeof f.title === "string") : [];
  const [open, setOpen] = useState(false);
  const key = JSON.stringify(features);
  const load = useMemo(() => async () => [{ id: `cms-${node.id}-${features.length}`, cards: features.map((f) => ({ id: f.id, title: f.title, description: f.body, image: f.image })) }], [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Button onClick={() => setOpen(true)}>{typeof props.label === "string" ? props.label : "What's new"}</Button>
      <WhatsNew load={load as never} open={open} onOpenChange={setOpen} storageKey={`cms-whats-new-${node.id}`} />
    </>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-whats-new:WhatsNew": KitWhatsNew,
};
