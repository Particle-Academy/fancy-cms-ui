import type { PageDoc } from "../document/types";
import type { PageOp } from "../document/ops";

export interface DraftField {
  key: string;
  label: string;
  read: (doc: PageDoc) => string | undefined;
  op: (raw: string) => PageOp;
  canonical: (raw: string) => string;
}

interface Draft {
  field: DraftField;
  raw: string;
  base: string | undefined;
  focused: boolean;
  dirty: boolean;
  conflict: string | null;
  readyAt: number;
}

/** Inspector drafts outlive field mounts. Only one proposal awaits host acknowledgement. */
export class InspectorDrafts {
  private drafts = new Map<string, Draft>();
  private composing = new Set<string>();
  private focused: string | null = null;
  private flight: { draft: Draft; expected: string } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private ackTimer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private version = 0;
  private disabled = false;
  private emit: (op: PageOp) => boolean = () => false;

  constructor(private doc: PageDoc) {}

  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = (): number => this.version;
  get busy(): boolean { return this.flight !== null || [...this.drafts.values()].some((draft) => draft.dirty || draft.conflict !== null); }
  get conflicts(): ReadonlyArray<{ key: string; label: string; message: string; missing: boolean }> {
    return [...this.drafts.values()].filter((draft) => draft.conflict !== null).map((draft) => ({
      key: draft.field.key, label: draft.field.label, message: draft.conflict!, missing: draft.field.read(this.doc) === undefined,
    }));
  }
  value(key: string, accepted: string): string { return this.drafts.get(key)?.raw ?? accepted; }

  configure(doc: PageDoc, disabled: boolean, emit: (op: PageOp) => boolean): void {
    const settled = this.disabled && !disabled;
    this.doc = doc; this.disabled = disabled; this.emit = emit;
    let changed = false;
    for (const [key, draft] of this.drafts) {
      const accepted = draft.field.read(doc);
      if (this.flight?.draft === draft && accepted === this.flight.expected) {
        this.clearFlight(); draft.base = accepted;
        draft.dirty = draft.field.canonical(draft.raw) !== accepted;
        if (!draft.dirty && !draft.focused) this.drafts.delete(key);
        changed = true;
      } else if (accepted !== draft.base) {
        this.conflict(draft, accepted === undefined ? "The edited element was removed. Your draft is retained." : "The server changed this field. Your draft is retained.");
        draft.base = accepted; changed = true;
      } else if (settled && this.flight?.draft === draft) {
        this.conflict(draft, "The save was not accepted. Your draft is retained."); changed = true;
      }
    }
    if (changed) this.notify();
    this.arm();
  }

  focus(key: string): void {
    this.focused = key;
    const draft = this.drafts.get(key); if (draft) draft.focused = true;
  }
  change(field: DraftField, raw: string): void {
    let draft = this.drafts.get(field.key);
    if (!draft) {
      draft = { field, raw, base: field.read(this.doc), focused: this.focused === field.key, dirty: true, conflict: null, readyAt: Date.now() + 250 };
      this.drafts.set(field.key, draft);
    } else {
      draft.field = field; draft.raw = raw; draft.readyAt = Date.now() + 250;
    }
    draft.dirty = field.canonical(raw) !== draft.base;
    this.notify(); this.arm();
  }
  blur(key: string): void {
    if (this.focused === key) this.focused = null;
    const draft = this.drafts.get(key);
    if (draft) {
      draft.focused = false; draft.readyAt = Date.now();
      if (!draft.dirty && !draft.conflict && this.flight?.draft !== draft) this.drafts.delete(key);
      this.notify(); this.pump();
    }
  }
  composition(key: string, active: boolean): void {
    if (active) this.composing.add(key); else this.composing.delete(key);
    const draft = this.drafts.get(key); if (draft) draft.readyAt = Date.now() + 250;
    this.arm();
  }
  resolve(key: string, keep: boolean): void {
    if (this.disabled) return;
    const draft = this.drafts.get(key); if (!draft) return;
    if (this.flight?.draft === draft) this.clearFlight();
    if (!keep) this.drafts.delete(key);
    else {
      const accepted = draft.field.read(this.doc); if (accepted === undefined) return;
      draft.base = accepted; draft.conflict = null; draft.dirty = draft.field.canonical(draft.raw) !== accepted;
      draft.readyAt = Date.now();
      if (!draft.dirty && !draft.focused) this.drafts.delete(key);
    }
    this.notify(); this.pump();
  }
  dispose(): void { clearTimeout(this.timer); clearTimeout(this.ackTimer); }

  private notify(): void { this.version++; for (const listener of this.listeners) listener(); }
  private clearFlight(): void { this.flight = null; clearTimeout(this.ackTimer); this.ackTimer = undefined; }
  private conflict(draft: Draft, message: string): void {
    draft.conflict = message;
    if (this.flight?.draft === draft) this.clearFlight();
  }
  private arm(): void {
    clearTimeout(this.timer); this.timer = undefined;
    if (this.disabled || this.flight || this.conflicts.length > 0) return;
    const ready = [...this.drafts.values()].filter((draft) => draft.dirty && !this.composing.has(draft.field.key));
    if (ready.length) this.timer = setTimeout(() => this.pump(), Math.max(0, Math.min(...ready.map((draft) => draft.readyAt)) - Date.now()));
  }
  private pump(): void {
    if (this.disabled || this.flight || this.conflicts.length > 0) return;
    const draft = [...this.drafts.values()].find((item) => item.dirty && item.readyAt <= Date.now() && !this.composing.has(item.field.key));
    if (!draft) { this.arm(); return; }
    this.flight = { draft, expected: draft.field.canonical(draft.raw) };
    this.ackTimer = setTimeout(() => {
      this.conflict(draft, "The save has not been acknowledged. Your draft is retained."); this.notify();
    }, 10000);
    try {
      if (!this.emit(draft.field.op(draft.raw))) this.conflict(draft, "This edit could not be submitted. Your draft is retained.");
    } catch {
      this.conflict(draft, "This edit could not be submitted. Your draft is retained.");
    }
    this.notify();
  }
}
