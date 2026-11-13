/**
 * react-fancy's overlays as islands. A page has no code, so each overlay brings
 * its own trigger: a Button labelled `label` that opens it. Menus hold links
 * (`{label, href}`), never actions; a container overlay's body is its child nodes.
 */
import { useState, type ReactElement } from "react";
import { Button, Command, ContextMenu, Drawer, Dropdown, FullScreen, Icon, MobileMenu, Modal, Popover, Toast, Tooltip, useToast } from "@particle-academy/react-fancy";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown, d = ""): string => (typeof v === "string" && v !== "" ? v : d);
type Link = { label: string; href: string; group?: string; icon?: string; active?: boolean };
const go = (href: string) => {
  if (typeof window !== "undefined") window.location.assign(href);
};

function KitModal({ props, children }: IslandComponentProps): ReactElement {
  const { label, title, ...rest } = props;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{str(label, "Open")}</Button>
      <Modal {...rest} open={open} onClose={() => setOpen(false)}>
        <Modal.Header>{str(title)}</Modal.Header>
        <Modal.Body>{children}</Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function KitDrawer({ props, children }: IslandComponentProps): ReactElement {
  const { label, title, ...rest } = props;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{str(label, "Open")}</Button>
      <Drawer {...rest} open={open} onClose={() => setOpen(false)}>
        <Drawer.Header>{str(title)}</Drawer.Header>
        <Drawer.Body>{children}</Drawer.Body>
      </Drawer>
    </>
  );
}

function KitPopover({ props, children }: IslandComponentProps): ReactElement {
  const { label, ...rest } = props;
  return (
    <Popover {...rest}>
      <Popover.Trigger>
        <Button>{str(label, "More")}</Button>
      </Popover.Trigger>
      <Popover.Content>{children}</Popover.Content>
    </Popover>
  );
}

function KitTooltip({ props }: IslandComponentProps): ReactElement {
  const { label, tip, href, ...rest } = props;
  return (
    <Tooltip {...rest} content={str(tip)}>
      <Button href={typeof href === "string" ? href : undefined}>{str(label)}</Button>
    </Tooltip>
  );
}

function KitDropdown({ props }: IslandComponentProps): ReactElement {
  const { label, items, ...rest } = props;
  return (
    <Dropdown {...rest}>
      <Dropdown.Trigger>
        <Button iconTrailing="chevron-down">{str(label, "Menu")}</Button>
      </Dropdown.Trigger>
      <Dropdown.Items>
        {list<Link>(items).map((l, i) => (
          <Dropdown.Item key={i} onClick={() => go(l.href)}>
            {l.label}
          </Dropdown.Item>
        ))}
      </Dropdown.Items>
    </Dropdown>
  );
}

function KitContextMenu({ props }: IslandComponentProps): ReactElement {
  return (
    <ContextMenu>
      <ContextMenu.Trigger>
        <div tabIndex={0} data-kit-context-area="">
          {str(props.label, "Right-click here")}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        {list<Link>(props.items).map((l, i) => (
          <ContextMenu.Item key={i} onClick={() => go(l.href)}>
            {l.label}
          </ContextMenu.Item>
        ))}
      </ContextMenu.Content>
    </ContextMenu>
  );
}

function KitCommand({ props }: IslandComponentProps): ReactElement {
  const { label, placeholder, items, ...rest } = props;
  const [open, setOpen] = useState(false);
  const links = list<Link>(items);
  const groups = [...new Set(links.map((l) => l.group ?? ""))];
  return (
    <>
      <Button icon="search" onClick={() => setOpen(true)}>
        {str(label, "Search")}
      </Button>
      <Command {...rest} open={open} onClose={() => setOpen(false)}>
        <Command.Input placeholder={str(placeholder, "Search")} aria-label={str(placeholder, "Search")} />
        <Command.List>
          {groups.map((g) => {
            const rows = links.filter((l) => (l.group ?? "") === g).map((l) => (
              <Command.Item key={l.href} value={l.label} onSelect={() => go(l.href)}>
                {l.label}
              </Command.Item>
            ));
            return g ? (
              <Command.Group key={g} heading={g}>
                {rows}
              </Command.Group>
            ) : (
              rows
            );
          })}
          <Command.Empty>No results</Command.Empty>
        </Command.List>
      </Command>
    </>
  );
}

function ToastButton({ label, title, description, variant }: { label: string; title: string; description?: string; variant?: string }): ReactElement {
  const { toast } = useToast();
  return <Button onClick={() => toast({ title, description, variant: variant as never })}>{label}</Button>;
}

function KitToast({ props }: IslandComponentProps): ReactElement {
  return (
    <Toast.Provider position="bottom-end">
      <ToastButton label={str(props.label, "Notify")} title={str(props.title)} description={str(props.description) || undefined} variant={str(props.variant) || undefined} />
    </Toast.Provider>
  );
}

function KitMobileMenu({ props }: IslandComponentProps): ReactElement {
  const { label, items, ...rest } = props;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon="menu" onClick={() => setOpen(true)} aria-label={str(label, "Menu")}>
        {str(label, "Menu")}
      </Button>
      <MobileMenu.Flyout {...rest} open={open} onClose={() => setOpen(false)}>
        {list<Link>(items).map((l, i) => (
          <MobileMenu.Item key={i} href={l.href} active={l.active} icon={l.icon ? <Icon name={l.icon} size="sm" aria-hidden /> : undefined}>
            {l.label}
          </MobileMenu.Item>
        ))}
      </MobileMenu.Flyout>
    </>
  );
}

function KitFullScreen({ props, children }: IslandComponentProps): ReactElement {
  return (
    <FullScreen {...props}>
      <FullScreen.Toggle />
      {children}
    </FullScreen>
  );
}

export const islands: Record<string, IslandComponent> = {
  "react-fancy:Modal": KitModal,
  "react-fancy:Drawer": KitDrawer,
  "react-fancy:Popover": KitPopover,
  "react-fancy:Tooltip": KitTooltip,
  "react-fancy:Dropdown": KitDropdown,
  "react-fancy:ContextMenu": KitContextMenu,
  "react-fancy:Command": KitCommand,
  "react-fancy:Toast": KitToast,
  "react-fancy:MobileMenu": KitMobileMenu,
  "react-fancy:FullScreen": KitFullScreen,
};

