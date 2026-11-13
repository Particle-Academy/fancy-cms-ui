/** react-fancy's navigation and disclosure components as islands. Links are JSON `{label, href}`. */
import { useState, type ReactElement } from "react";
import {
  Accordion,
  AccordionPanel,
  Breadcrumbs,
  Button,
  Calendar,
  Icon,
  Menu,
  Navbar,
  Pagination,
  Sidebar,
  SkipLink,
  Tabs,
  TreeNav,
} from "@particle-academy/react-fancy";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";
import { useIslandState } from "../generic";

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
type Link = { label: string; href?: string; icon?: string; active?: boolean; items?: Link[] };

function KitTabs({ props }: IslandComponentProps): ReactElement {
  const { tabs: raw, ...rest } = props;
  const tabs = list<{ value: string; label: string; body?: string[] }>(raw);
  const [active, setActive] = useIslandState<string>(rest, { value: "activeTab", change: "onTabChange" });
  return (
    <Tabs {...rest} activeTab={active ?? tabs[0]?.value} onTabChange={(v: string) => setActive(v)}>
      <Tabs.List>
        {tabs.map((t) => (
          <Tabs.Tab key={t.value} value={t.value}>
            {t.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <Tabs.Panels>
        {tabs.map((t) => (
          <Tabs.Panel key={t.value} value={t.value}>
            {list<string>(t.body).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </Tabs.Panel>
        ))}
      </Tabs.Panels>
    </Tabs>
  );
}

function KitAccordion({ props }: IslandComponentProps): ReactElement {
  const { items, ...rest } = props;
  return (
    <Accordion type="single" {...rest}>
      {list<{ value: string; title: string; body: string }>(items).map((item) => (
        <Accordion.Item key={item.value} value={item.value}>
          <Accordion.Trigger>{item.title}</Accordion.Trigger>
          <Accordion.Content>
            <p>{item.body}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

function KitAccordionPanel({ props }: IslandComponentProps): ReactElement {
  const { sections, ...rest } = props;
  const [open, setOpen] = useState<string[]>([]);
  return (
    <AccordionPanel {...rest} value={open} onValueChange={setOpen}>
      {list<{ id: string; label: string; icon?: string; links?: Link[] }>(sections).map((s) => (
        <AccordionPanel.Section key={s.id} id={s.id}>
          <AccordionPanel.Trigger aria-label={s.label}>{s.label}</AccordionPanel.Trigger>
          <AccordionPanel.Content>
            {list<Link>(s.links).map((l, i) => (
              <Button key={i} href={l.href}>
                {l.label}
              </Button>
            ))}
          </AccordionPanel.Content>
        </AccordionPanel.Section>
      ))}
    </AccordionPanel>
  );
}

function KitBreadcrumbs({ props }: IslandComponentProps): ReactElement {
  const { items, ...rest } = props;
  const crumbs = list<Link>(items);
  return (
    <Breadcrumbs {...rest}>
      {crumbs.map((c, i) => (
        <Breadcrumbs.Item key={i} href={i === crumbs.length - 1 ? undefined : c.href} active={i === crumbs.length - 1}>
          {c.label}
        </Breadcrumbs.Item>
      ))}
    </Breadcrumbs>
  );
}

function KitNavbar({ props }: IslandComponentProps): ReactElement {
  const brand = str(props.brand);
  return (
    <Navbar>
      {brand ? (
        <Navbar.Brand>
          <a href={str(props.brandHref) ?? "/"}>{brand}</a>
        </Navbar.Brand>
      ) : null}
      <Navbar.Items>
        {list<Link>(props.items).map((l, i) => (
          <Navbar.Item key={i} href={l.href} active={l.active}>
            {l.label}
          </Navbar.Item>
        ))}
      </Navbar.Items>
      <Navbar.Toggle />
    </Navbar>
  );
}

const icon = (name?: string) => (name ? <Icon name={name} size="sm" aria-hidden /> : undefined);

function KitMenu({ props }: IslandComponentProps): ReactElement {
  const { items, ...rest } = props;
  return (
    <Menu {...rest}>
      {list<Link>(items).map((l, i) =>
        l.items && l.items.length ? (
          <Menu.Submenu key={i} label={l.label} icon={icon(l.icon)}>
            {l.items.map((s, j) => (
              <Menu.Item key={j} href={s.href}>
                {s.label}
              </Menu.Item>
            ))}
          </Menu.Submenu>
        ) : (
          <Menu.Item key={i} href={l.href} icon={icon(l.icon)} active={l.active}>
            {l.label}
          </Menu.Item>
        ),
      )}
    </Menu>
  );
}

function KitSidebar({ props }: IslandComponentProps): ReactElement {
  const { items, ...rest } = props;
  const [collapsed, setCollapsed] = useIslandState<boolean>(rest, { value: "collapsed", default: "defaultCollapsed", change: "onCollapsedChange" });
  delete rest.defaultCollapsed;
  return (
    <Sidebar {...rest} embedded collapsed={collapsed ?? false} onCollapsedChange={(v: boolean) => setCollapsed(v)}>
      {list<Link>(items).map((l, i) =>
        l.items && l.items.length ? (
          <Sidebar.Group key={i} label={l.label}>
            {l.items.map((s, j) => (
              <Sidebar.Item key={j} href={s.href}>
                {s.label}
              </Sidebar.Item>
            ))}
          </Sidebar.Group>
        ) : (
          <Sidebar.Item key={i} href={l.href} icon={icon(l.icon)} active={l.active}>
            {l.label}
          </Sidebar.Item>
        ),
      )}
      <Sidebar.Toggle />
    </Sidebar>
  );
}

function KitPagination({ props }: IslandComponentProps): ReactElement {
  const { hrefPattern, ...rest } = props;
  const [page, setPage] = useIslandState<number>(rest, { value: "page", change: "onPageChange" });
  const pattern = str(hrefPattern);
  const go = (n: number) => {
    setPage(n);
    if (pattern && typeof window !== "undefined") window.location.assign(pattern.split("{page}").join(String(n)));
  };
  return <Pagination {...(rest as { totalPages: number })} page={page ?? 1} onPageChange={go} />;
}

function KitSkipLink({ props }: IslandComponentProps): ReactElement {
  const { label, ...rest } = props;
  return <SkipLink {...rest} label={str(label)} />;
}

function KitTreeNav({ props }: IslandComponentProps): ReactElement {
  const [selected, setSelected] = useIslandState<string>(props, { value: "selectedId", change: "onSelect" });
  return <TreeNav {...(props as { nodes: never[] })} selectedId={selected} onSelect={(id: string) => setSelected(id)} />;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(\d{2})$/;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function KitCalendar({ props }: IslandComponentProps): ReactElement {
  const events = list<{ date: string; title: string }>(props.events).filter((e) => DATE.test(String(e.date)));
  const month = typeof props.month === "string" ? MONTH.exec(props.month) : null;
  const first = events[0] ? DATE.exec(events[0].date) : null;
  const visible = month ? new Date(Number(month[1]), Number(month[2]) - 1, 1, 12) : first ? new Date(Number(first[1]), Number(first[2]) - 1, Number(first[3]), 12) : undefined;
  const [day, setDay] = useState<Date | null>(first ? new Date(Number(first[1]), Number(first[2]) - 1, Number(first[3]), 12) : null);
  const key = day ? iso(day) : "";
  const today = events.filter((e) => e.date === key);
  return (
    <div>
      <Calendar value={day} onChange={(v: unknown) => setDay(v instanceof Date ? v : null)} visibleMonth={visible} />
      <ul aria-live="polite">
        {today.map((e, i) => (
          <li key={i}>{e.title}</li>
        ))}
      </ul>
    </div>
  );
}

export const islands: Record<string, IslandComponent> = {
  "react-fancy:Tabs": KitTabs,
  "react-fancy:Accordion": KitAccordion,
  "react-fancy:AccordionPanel": KitAccordionPanel,
  "react-fancy:Breadcrumbs": KitBreadcrumbs,
  "react-fancy:Navbar": KitNavbar,
  "react-fancy:Menu": KitMenu,
  "react-fancy:Sidebar": KitSidebar,
  "react-fancy:Pagination": KitPagination,
  "react-fancy:SkipLink": KitSkipLink,
  "react-fancy:TreeNav": KitTreeNav,
  "react-fancy:Calendar": KitCalendar,
};

