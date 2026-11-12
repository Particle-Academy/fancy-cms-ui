/**
 * Page inputs: the `input` node family (period, date range, person or team,
 * select, multi-select) as pure models.
 *
 * An input declares a `name`, a `kind` and a `default`; its options are literal
 * or `$bind` to a host-supplied list. Its VALUE is part of the data-context
 * request: `CmsPage` hands the values to the host's `loadData` callback, and a
 * PHP host reads them from the query string (`FancyCms\Data\PageInputs`). The
 * host answers with new data and the bound nodes redraw.
 *
 * Every value is normalised the same way on both sides, so a value from a URL
 * or an agent can never put the page in a state the controls cannot show: a
 * value that is not one of the options, a malformed date or a reversed range
 * falls back to the default, and a malformed default to the first option.
 * `FancyCms\Data\PageInputs` and `FancyCms\Render\Inputs` are the PHP twins;
 * tests/fixtures/inputs.json is the shared spec.
 */
import { hasNodeMap, isBinding, type PageDoc } from "../document/types";

export const INPUT_KINDS = ["period", "daterange", "person", "select", "multiselect"] as const;
export type InputKind = (typeof INPUT_KINDS)[number];

/**
 * What an input's `name` must look like: it becomes a query parameter, an
 * element id, and what a binding's `{ "$input": "<name>" }` names (the same
 * grammar Charlotte checks those references against).
 */
export const INPUT_NAME_PATTERN = /^[a-z][a-z0-9-]{0,47}$/;

export const INPUT_EMPTY_TEXT = "No options available";

/** The periods a `period` input offers when it declares no options of its own. The host decides what each means. */
export const PERIOD_PRESETS: readonly InputOption[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

export interface InputOption {
  value: string;
  label: string;
}
export interface DateRange {
  from: string;
  to: string;
}
/** period, person and select hold a string; multiselect a list; daterange a `{ from, to }` pair of ISO dates. */
export type InputValue = string | string[] | DateRange;
export type InputValues = Record<string, InputValue>;

/** One declared input: what a host reads to know which values a page will send. */
export interface InputDeclaration {
  node: string;
  name: string;
  kind: InputKind;
}

export interface InputModel {
  valid: boolean;
  kind: InputKind;
  name: string;
  label: string;
  fromLabel: string;
  toLabel: string;
  options: InputOption[];
  value: InputValue;
  empty: string;
}

type Props = Record<string, unknown>;
const has = Object.prototype.hasOwnProperty;
const MAX_OPTIONS = 500;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function own(rec: unknown, key: string): unknown {
  return isRecord(rec) && has.call(rec, key) ? rec[key] : undefined;
}
function text(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}
/** A string or a finite number as an option value; anything else is not one. */
function scalar(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

export function inputKind(props: Props): InputKind {
  const kind = props.kind;
  return typeof kind === "string" && (INPUT_KINDS as readonly string[]).includes(kind) ? (kind as InputKind) : "select";
}

/** A real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = DATE.exec(v);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day <= days;
}

/**
 * The options an input offers, from its resolved `options` prop: strings,
 * numbers or `{ value, label }` objects; empty and repeated values dropped.
 * null when they are not knowable (a binding the data does not satisfy), so a
 * value is then checked for its shape only.
 */
export function inputOptions(kind: InputKind, raw: unknown): InputOption[] | null {
  if (kind === "daterange") return [];
  if (raw === undefined || raw === null) return kind === "period" ? PERIOD_PRESETS.map((o) => ({ ...o })) : null;
  if (!Array.isArray(raw)) return null;
  const out: InputOption[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (out.length >= MAX_OPTIONS) break;
    let value = scalar(entry);
    let label = value;
    if (value === null && isRecord(entry)) {
      value = scalar(own(entry, "value"));
      const l = own(entry, "label");
      label = typeof l === "string" && l !== "" ? l : value;
    }
    if (value === null || value === "" || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: label! });
  }
  return out;
}

function pick(kind: InputKind, options: InputOption[] | null, raw: unknown): InputValue | null {
  if (kind === "daterange") {
    const from = own(raw, "from");
    const to = own(raw, "to");
    return isIsoDate(from) && isIsoDate(to) && from <= to ? { from, to } : null;
  }
  if (kind === "multiselect") {
    if (!Array.isArray(raw) || !raw.every((v) => typeof v === "string")) return null;
    const picked = new Set(raw as string[]);
    if (options === null) return [...picked].filter((v) => v !== "");
    return options.filter((o) => picked.has(o.value)).map((o) => o.value);
  }
  if (typeof raw !== "string" || raw === "") return null;
  if (options === null) return raw;
  return options.some((o) => o.value === raw) ? raw : null;
}

/** The value an input holds: the raw value when it fits, else the default, else the first option (or nothing). */
export function normalizeInput(kind: InputKind, options: InputOption[] | null, raw: unknown, fallback: unknown): InputValue {
  const chosen = pick(kind, options, raw) ?? pick(kind, options, fallback);
  if (chosen !== null) return chosen;
  if (kind === "daterange") return { from: "", to: "" };
  if (kind === "multiselect") return [];
  return options && options.length > 0 ? options[0]!.value : "";
}

/** The model a renderer draws, from the node's RESOLVED props and its raw current value. */
export function inputModel(props: Props, raw: unknown, declared = true): InputModel {
  const kind = inputKind(props);
  const name = typeof props.name === "string" ? props.name : "";
  const options = inputOptions(kind, props.options);
  const value = normalizeInput(kind, options, raw, props.default);
  const valid = declared && INPUT_NAME_PATTERN.test(name) && (kind === "daterange" || (options !== null && options.length > 0));
  return {
    valid,
    kind,
    name,
    label: text(props.label) || name,
    fromLabel: text(props.fromLabel) || "From",
    toLabel: text(props.toLabel) || "To",
    options: options ?? [],
    value,
    empty: text(props.emptyText) || INPUT_EMPTY_TEXT,
  };
}

function propsOf(node: unknown): Props {
  const props = own(node, "props");
  return isRecord(props) ? props : {};
}

/**
 * Every input a document declares, ordered by node id. A name is declared once:
 * the first node (by id) to use a valid name owns it, and a later node with the
 * same name renders its empty state rather than a second control.
 */
export function pageInputs(doc: PageDoc): InputDeclaration[] {
  if (!hasNodeMap(doc)) return [];
  const out: InputDeclaration[] = [];
  const seen = new Set<string>();
  for (const id of Object.keys(doc.nodes).sort()) {
    const node = doc.nodes[id];
    if (own(node, "type") !== "input") continue;
    const props = propsOf(node);
    const name = props.name;
    if (typeof name !== "string" || !INPUT_NAME_PATTERN.test(name) || seen.has(name)) continue;
    seen.add(name);
    out.push({ node: id, name, kind: inputKind(props) });
  }
  return out;
}

function resolve(v: unknown, data: Record<string, unknown> | undefined): unknown {
  if (!isBinding(v)) return v;
  return v.$bind.split(".").reduce<unknown>((o, k) => {
    if (o === null || typeof o !== "object") return undefined;
    if (Array.isArray(o)) return /^(0|[1-9][0-9]*)$/.test(k) ? o[Number(k)] : undefined;
    return has.call(o, k) ? (o as Record<string, unknown>)[k] : undefined;
  }, data);
}

function declaredWithProps(doc: PageDoc, data: Record<string, unknown> | undefined): { decl: InputDeclaration; options: InputOption[] | null; fallback: unknown }[] {
  return pageInputs(doc).map((decl) => {
    const props = propsOf(doc.nodes[decl.node]);
    return { decl, options: inputOptions(decl.kind, resolve(props.options, data)), fallback: resolve(props.default, data) };
  });
}

/**
 * The normalised value of every declared input. `raw` holds what the page was
 * asked for (a URL, an agent, the last change); `data` is the context the
 * options resolve against, so a bound list of people is checked against the
 * people the host actually supplied.
 */
export function inputValues(doc: PageDoc, raw: Record<string, unknown> = {}, data?: Record<string, unknown>): InputValues {
  const out: InputValues = {};
  for (const { decl, options, fallback } of declaredWithProps(doc, data)) {
    out[decl.name] = normalizeInput(decl.kind, options, has.call(raw, decl.name) ? raw[decl.name] : undefined, fallback);
  }
  return out;
}

/** A query parameter's value in the shape PHP's own parser gives it. */
function fromSearch(params: URLSearchParams, decl: InputDeclaration): unknown {
  const { name, kind } = decl;
  if (kind === "multiselect") return params.has(`${name}[]`) ? params.getAll(`${name}[]`) : undefined;
  if (kind === "daterange") {
    return params.has(`${name}[from]`) || params.has(`${name}[to]`) ? { from: params.get(`${name}[from]`) ?? "", to: params.get(`${name}[to]`) ?? "" } : undefined;
  }
  return params.has(name) ? params.get(name) : undefined;
}

/**
 * The input values a URL asks for. `query` is a search string, URLSearchParams,
 * or an already-parsed object in PHP's shape (`{ teams: ["a"], range: { from, to } }`).
 * The encoding is `name=v`, `name[]=v` per selection, and `name[from]` / `name[to]`.
 */
export function inputsFromQuery(doc: PageDoc, query: string | URLSearchParams | Record<string, unknown>, data?: Record<string, unknown>): InputValues {
  if (typeof query === "string" || query instanceof URLSearchParams) {
    const params = typeof query === "string" ? new URLSearchParams(query.startsWith("?") ? query.slice(1) : query) : query;
    const raw: Record<string, unknown> = {};
    for (const decl of pageInputs(doc)) {
      const v = fromSearch(params, decl);
      if (v !== undefined) raw[decl.name] = v;
    }
    return inputValues(doc, raw, data);
  }
  return inputValues(doc, query, data);
}

/** RFC 3986 percent-encoding: what PHP's rawurlencode writes. */
function encode(v: string): string | null {
  try {
    return encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  } catch {
    return null;
  }
}

function same(a: InputValue, b: InputValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The query string for a set of values, without the leading `?`. A value equal
 * to its input's default is left out, so the plain URL is the default page.
 */
export function inputsToQuery(doc: PageDoc, values: Record<string, unknown>, data?: Record<string, unknown>): string {
  const parts: string[] = [];
  const normal = inputValues(doc, values, data);
  const defaults = inputValues(doc, {}, data);
  for (const { decl } of declaredWithProps(doc, data)) {
    const v = normal[decl.name]!;
    if (same(v, defaults[decl.name]!)) continue;
    const add = (key: string, value: string) => {
      const e = encode(value);
      if (e !== null) parts.push(`${key}=${e}`);
    };
    if (Array.isArray(v)) {
      for (const item of v) add(`${decl.name}[]`, item);
    } else if (typeof v === "string") {
      add(decl.name, v);
    } else {
      add(`${decl.name}[from]`, v.from);
      add(`${decl.name}[to]`, v.to);
    }
  }
  return parts.join("&");
}

/**
 * The stylesheet block for page inputs, emitted after the base only on pages
 * that place one. Byte-identical to `FancyCms\Render\Inputs::CSS`.
 */
export const INPUT_CSS = `/* fancy-cms inputs */

:where([data-cms-input]) {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

:where([data-cms-input] fieldset) {
  border: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  min-width: 0;
  padding: 0;
}

:where([data-cms-input] legend) {
  font-weight: 600;
  margin-bottom: 6px;
  padding: 0;
  width: 100%;
}

:where([data-cms-input] > label) {
  font-weight: 600;
}

:where([data-cms-input] select, [data-cms-input] input[type="date"]) {
  background: transparent;
  border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
  border-radius: 6px;
  color: inherit;
  font: inherit;
  min-height: 44px;
  padding: 8px 10px;
}

:where([data-cms-input] fieldset label) {
  align-items: center;
  display: inline-flex;
  gap: 6px;
  min-height: 44px;
}`;
