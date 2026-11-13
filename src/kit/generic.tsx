/**
 * The generic kit adapter: most kit components take their island props as they
 * are, plus at most a text child and one piece of controlled state. `generic`
 * builds the island component for one of those from the manifest's settings.
 *
 *   generic(Badge, { children: "text" })
 *   generic(Switch, { state: { value: "checked", default: "defaultChecked", change: "onCheckedChange" } })
 *
 * State: the island prop named `state.value` (or `state.default`) is the
 * initial value; after that the island owns it, so the component stays
 * controlled (the component contract) while the page has no code of its own.
 */
import { useState, type ComponentType, type ReactElement, type ReactNode } from "react";
import type { IslandComponent, IslandComponentProps } from "../react/islands";

export interface StateSpec {
  value: string;
  default?: string;
  change: string;
}

export interface GenericOptions {
  /** `text`: the island's `text` prop is the component's children. `slot`: its child nodes are. */
  children?: "text" | "slot";
  state?: StateSpec;
  /** Fixed props, applied under the island's own (a sensible default the catalogue does not offer). */
  defaults?: Record<string, unknown>;
  /** Last-word props the island cannot override (e.g. `readOnly` on a page). */
  force?: Record<string, unknown>;
}

/** Island props split into the component's props and its children. */
export function componentProps(p: IslandComponentProps, opts: GenericOptions): { props: Record<string, unknown>; children: ReactNode } {
  const props: Record<string, unknown> = { ...(opts.defaults ?? {}), ...p.props };
  let children: ReactNode = undefined;
  if (opts.children === "text") {
    const t = props.text;
    children = typeof t === "string" || typeof t === "number" ? String(t) : undefined;
    delete props.text;
  } else if (opts.children === "slot") {
    children = p.children;
  }
  Object.assign(props, opts.force ?? {});
  return { props, children };
}

/** Holds one controlled value: the initial value from the island, then the visitor's. */
export function useIslandState<T>(props: Record<string, unknown>, spec: StateSpec | undefined): [T | undefined, (v: T) => void] {
  const initial = spec ? (props[spec.value] !== undefined ? props[spec.value] : spec.default ? props[spec.default] : undefined) : undefined;
  const [value, setValue] = useState<T | undefined>(initial as T | undefined);
  return [value, setValue];
}

export function generic(Component: ComponentType<any>, opts: GenericOptions = {}): IslandComponent {
  function KitIsland(p: IslandComponentProps): ReactElement {
    const { props, children } = componentProps(p, opts);
    const [value, setValue] = useIslandState<unknown>(props, opts.state);
    if (opts.state) {
      if (opts.state.default) delete props[opts.state.default];
      props[opts.state.value] = value;
      props[opts.state.change] = (next: unknown) => setValue(next);
    }
    return <Component {...props}>{children}</Component>;
  }
  KitIsland.displayName = `Kit(${Component.displayName ?? Component.name ?? "Component"})`;
  return KitIsland;
}
