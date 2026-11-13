/**
 * fancy-app-update's card stacks as kit islands, each opened by its own
 * button. The update stack never polls here: a page cannot know a build
 * endpoint, so the island shows the "new version" notice on demand.
 */
import { useState, type ReactElement } from "react";
import { Button } from "@particle-academy/react-fancy";
import { FeatureCards } from "@particle-academy/fancy-app-update/cards";
import { AppUpdateStack } from "@particle-academy/fancy-app-update/stack";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";

function KitFeatureCards({ props }: IslandComponentProps): ReactElement {
  const { label, action, ...rest } = props;
  void action;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{typeof label === "string" ? label : "What's new"}</Button>
      {open ? <FeatureCards {...(rest as { cards: never[] })} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function KitAppUpdateStack({ props }: IslandComponentProps): ReactElement {
  const { open: initial, ...rest } = props;
  const [open, setOpen] = useState(initial === true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{typeof rest.label === "string" ? rest.label : "Update available"}</Button>
      <AppUpdateStack {...rest} enabled={false} open={open} onOpenChange={setOpen} onRefresh={() => setOpen(false)} />
    </>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-app-update:FeatureCards": KitFeatureCards,
  "fancy-app-update:AppUpdateStack": KitAppUpdateStack,
};
