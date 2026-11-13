/** fancy-brand-icons as one island: `name` picks the mark. */
import type { ComponentType, ReactElement } from "react";
import * as marks from "@particle-academy/fancy-brand-icons";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";

const BY_NAME: Record<string, string> = {
  anthropic: "AnthropicIcon", apple: "AppleIcon", cloudflare: "CloudflareIcon", discord: "DiscordIcon", figma: "FigmaIcon",
  github: "GithubIcon", gmail: "GmailIcon", google: "GoogleIcon", javascript: "JavascriptIcon", laravel: "LaravelIcon",
  linkedin: "LinkedinIcon", node: "NodeIcon", notion: "NotionIcon", npm: "NpmIcon", openai: "OpenaiIcon", php: "PhpIcon",
  react: "ReactIcon", slack: "SlackIcon", stripe: "StripeIcon", tailwind: "TailwindIcon", typescript: "TypescriptIcon",
  vercel: "VercelIcon", x: "XIcon", youtube: "YoutubeIcon",
};

function KitBrandIcon({ props }: IslandComponentProps): ReactElement | null {
  const exported = typeof props.name === "string" ? BY_NAME[props.name] : undefined;
  const Mark = exported ? ((marks as Record<string, unknown>)[exported] as ComponentType<Record<string, unknown>> | undefined) : undefined;
  if (!Mark) return null;
  const label = typeof props.label === "string" && props.label !== "" ? props.label : undefined;
  const size = typeof props.size === "number" ? props.size : 32;
  return (
    <span {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} style={{ display: "inline-flex", width: size, height: size }}>
      <Mark width={size} height={size} aria-hidden="true" />
    </span>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-brand-icons:BrandIcon": KitBrandIcon,
};
