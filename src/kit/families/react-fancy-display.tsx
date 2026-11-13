/** react-fancy's display components as islands: text, badges, stats, cards and the like. */
import type { ReactElement } from "react";
import {
  ActivityLight,
  Avatar,
  Badge,
  Brand,
  Callout,
  Card,
  ContentReaction,
  Emoji,
  Eyebrow,
  Heading,
  Icon,
  Kbd,
  Marquee,
  MoodMeter,
  Profile,
  Progress,
  PullQuote,
  QrCode,
  QrCodePanel,
  ReasonTag,
  Separator,
  Skeleton,
  Stat,
  StatBand,
  StatList,
  StickyNote,
  Text,
} from "@particle-academy/react-fancy";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";
import { generic, useIslandState } from "../generic";

const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function KitHeading({ props }: IslandComponentProps): ReactElement {
  const { level, text, ...rest } = props;
  const n = typeof level === "number" && level >= 1 && level <= 6 ? Math.floor(level) : 2;
  return (
    <Heading {...rest} as={`h${n}` as "h2"}>
      {typeof text === "string" ? text : undefined}
    </Heading>
  );
}

function KitIcon({ props }: IslandComponentProps): ReactElement {
  const { label, ...rest } = props;
  const name = str(label);
  return <Icon {...rest} {...(name ? { role: "img", "aria-label": name } : { "aria-hidden": true })} />;
}

function KitEmoji({ props }: IslandComponentProps): ReactElement {
  const { label, ...rest } = props;
  const name = str(label);
  return (
    <span {...(name ? { role: "img", "aria-label": name } : { "aria-hidden": true })}>
      <Emoji {...rest} />
    </span>
  );
}

function KitProgress({ props }: IslandComponentProps): ReactElement {
  const { label, ...rest } = props;
  return <Progress {...rest} aria-label={str(label) ?? "Progress"} />;
}

function KitKbd({ props }: IslandComponentProps): ReactElement {
  const { keys, ...rest } = props;
  return <Kbd {...rest} keys={list<string>(keys)} />;
}

function KitMarquee({ props }: IslandComponentProps): ReactElement {
  const { items, ...rest } = props;
  return <Marquee {...rest} items={list<string>(items)} />;
}

function KitStatBand({ props }: IslandComponentProps): ReactElement {
  const { items, ...rest } = props;
  return (
    <StatBand {...rest}>
      {list<{ value: string; label: string }>(items).map((s, i) => (
        <Stat key={i} value={s.value} label={s.label} />
      ))}
    </StatBand>
  );
}

function KitContentReaction({ props }: IslandComponentProps): ReactElement {
  const [value, setValue] = useIslandState<string[]>(props, { value: "value", change: "onChange" });
  return <ContentReaction {...props} value={value ?? []} onChange={(v: readonly string[]) => setValue([...v])} />;
}

function KitMoodMeter({ props }: IslandComponentProps): ReactElement {
  const [value, setValue] = useIslandState<number>(props, { value: "value", change: "onChange" });
  const min = typeof props.min === "number" ? props.min : 0;
  return <MoodMeter {...(props as { min: number; max: number; confidence: number })} value={value ?? min} onChange={(v: number) => setValue(v)} />;
}

export const islands: Record<string, IslandComponent> = {
  "react-fancy:Heading": KitHeading,
  "react-fancy:Text": generic(Text, { children: "text" }),
  "react-fancy:Separator": generic(Separator),
  "react-fancy:Badge": generic(Badge, { children: "text" }),
  "react-fancy:Icon": KitIcon,
  "react-fancy:Emoji": KitEmoji,
  "react-fancy:Avatar": generic(Avatar),
  "react-fancy:Profile": generic(Profile),
  "react-fancy:Skeleton": generic(Skeleton),
  "react-fancy:Progress": KitProgress,
  "react-fancy:Brand": generic(Brand),
  "react-fancy:Eyebrow": generic(Eyebrow, { children: "text" }),
  "react-fancy:Kbd": KitKbd,
  "react-fancy:PullQuote": generic(PullQuote, { children: "text" }),
  "react-fancy:Stat": generic(Stat),
  "react-fancy:StatBand": KitStatBand,
  "react-fancy:StatList": generic(StatList),
  "react-fancy:ActivityLight": generic(ActivityLight),
  "react-fancy:Callout": generic(Callout, { children: "slot" }),
  "react-fancy:Card": generic(Card, { children: "slot" }),
  "react-fancy:StickyNote": generic(StickyNote, { state: { value: "value", default: "defaultValue", change: "onChange" } }),
  "react-fancy:ReasonTag": generic(ReasonTag),
  "react-fancy:QrCode": generic(QrCode),
  "react-fancy:QrCodePanel": generic(QrCodePanel),
  "react-fancy:Marquee": KitMarquee,
  "react-fancy:ContentReaction": KitContentReaction,
  "react-fancy:MoodMeter": KitMoodMeter,
};
