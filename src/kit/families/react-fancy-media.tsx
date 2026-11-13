/** react-fancy's media components as islands. Every URL has passed the scheme check (kit/sanitize.ts). */
import { useState, type ReactElement } from "react";
import { AudioViewer, Carousel, ImagePill, ImageViewer, MediaViewer, PdfViewer, StreamingAudio, VideoViewer } from "@particle-academy/react-fancy";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";
import { generic, useIslandState } from "../generic";

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function KitCarousel({ props }: IslandComponentProps): ReactElement {
  const { slides, ...rest } = props;
  const [index, setIndex] = useState(0);
  return (
    <Carousel loop {...rest} activeIndex={index} onIndexChange={setIndex}>
      <Carousel.Panels>
        {list<{ name: string; title?: string; text?: string; image?: string; alt?: string }>(slides).map((s) => (
          <Carousel.Slide key={s.name} name={s.name}>
            {s.image ? <img src={s.image} alt={s.alt ?? ""} width={640} height={400} style={{ maxWidth: "100%", height: "auto" }} /> : null}
            {s.title ? (
              <p>
                <strong>{s.title}</strong>
              </p>
            ) : null}
            {s.text ? <p>{s.text}</p> : null}
          </Carousel.Slide>
        ))}
      </Carousel.Panels>
      <Carousel.Controls />
    </Carousel>
  );
}

function KitVideoViewer({ props }: IslandComponentProps): ReactElement {
  const { label, ...rest } = props;
  return <VideoViewer controls preload="metadata" {...(rest as { src: string })} aria-label={typeof label === "string" ? label : undefined} />;
}

function KitStreamingAudio({ props }: IslandComponentProps): ReactElement {
  const [value, setValue] = useIslandState<unknown>(props, { value: "value", change: "onChange" });
  return <StreamingAudio {...(props as { stations: never[] })} value={(value ?? { stationId: null, playing: false }) as never} onChange={(v: unknown) => setValue(v)} />;
}

/** A sized frame: the viewers are pan-and-zoom canvases with no intrinsic height. */
function sized(Component: Parameters<typeof generic>[0], height: number): IslandComponent {
  const Inner = generic(Component);
  function Sized(p: IslandComponentProps): ReactElement {
    return (
      <div style={{ height, width: "100%" }}>
        <Inner {...p} />
      </div>
    );
  }
  return Sized;
}

export const islands: Record<string, IslandComponent> = {
  "react-fancy:Carousel": KitCarousel,
  "react-fancy:MediaViewer": sized(MediaViewer, 360),
  "react-fancy:ImageViewer": sized(ImageViewer, 360),
  "react-fancy:VideoViewer": KitVideoViewer,
  "react-fancy:AudioViewer": generic(AudioViewer, { defaults: { controls: true, preload: "metadata" } }),
  "react-fancy:PdfViewer": sized(PdfViewer, 480),
  "react-fancy:ImagePill": generic(ImagePill),
  "react-fancy:StreamingAudio": KitStreamingAudio,
};
