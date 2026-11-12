/**
 * The infographic node kit — chart, kpi, table, leaderboard — as pure models.
 *
 * The page carries the SHAPE (which columns, which format, which binding) and
 * the host supplies the NUMBERS through the data context, resolved by the same
 * `{ $bind }` mechanism every other prop uses. Each model is built from props
 * that are already resolved, so a repeater scope or a live `$source` reaches an
 * infographic exactly as it reaches a text node.
 *
 * Missing or malformed data never throws: the model comes back `valid: false`
 * and the renderer shows the empty state. Both renderers build these models the
 * same way (`FancyCms\Render\Infographics` is the PHP twin), so the markup is
 * byte-identical — see tests/fixtures/infographics.json.
 */
import { formatNumber, formatSpec, signedNumber, toNumber, type NumberFormatSpec } from "./number-format";

export const INFOGRAPHIC_TYPES = ["chart", "kpi", "table", "leaderboard"] as const;
export type InfographicType = (typeof INFOGRAPHIC_TYPES)[number];
const TYPES = new Set<string>(INFOGRAPHIC_TYPES);
export const isInfographicType = (type: unknown): type is InfographicType => typeof type === "string" && TYPES.has(type);

export const EMPTY_TEXT = "No data available";

type Props = Record<string, unknown>;
const has = Object.prototype.hasOwnProperty;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function own(rec: Record<string, unknown>, key: string): unknown {
  return has.call(rec, key) ? rec[key] : undefined;
}
/** A resolved prop as display text: the same coercion every node's `text()` uses. */
function text(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}
/** A data cell as text. Objects and arrays render nothing, never "[object Object]". */
export function cellText(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return "";
}
function emptyText(props: Props): string {
  return text(props.emptyText) || EMPTY_TEXT;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
/** UTF-16 code-unit order — what PHP's Ordering::compare reproduces. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ── chart ────────────────────────────────────────────────────────────────────

export const CHART_KINDS = ["column", "bar", "line", "pie", "funnel"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];
export const CHART_SIZES = ["sm", "md", "lg"] as const;

export interface ChartSeries {
  name: string;
  values: (number | null)[];
}
export interface ChartModel {
  valid: boolean;
  kind: ChartKind;
  size: (typeof CHART_SIZES)[number];
  title: string;
  categoryLabel: string;
  categories: string[];
  series: ChartSeries[];
  spec: NumberFormatSpec;
  empty: string;
}

export function chartKind(props: Props): ChartKind {
  return oneOf(props.kind, CHART_KINDS, "column");
}
export function chartSize(props: Props): ChartModel["size"] {
  return oneOf(props.size, CHART_SIZES, "md");
}

function chartSeries(raw: unknown): ChartSeries[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (raw.every((v) => toNumber(v) !== null)) return [{ name: "Value", values: raw.map(toNumber) }];
  const out: ChartSeries[] = [];
  for (const [i, entry] of raw.entries()) {
    if (!isRecord(entry)) return null;
    const data = own(entry, "data");
    if (!Array.isArray(data)) return null;
    const name = own(entry, "name");
    out.push({ name: typeof name === "string" && name !== "" ? name : `Series ${i + 1}`, values: data.map(toNumber) });
  }
  return out;
}

export function chartModel(props: Props): ChartModel {
  const kind = chartKind(props);
  const rawCategories = props.categories;
  const categories =
    Array.isArray(rawCategories) && rawCategories.length > 0 && rawCategories.every((c) => typeof c === "string" || (typeof c === "number" && Number.isFinite(c)))
      ? rawCategories.map((c) => String(c))
      : null;
  let series = chartSeries(props.series);
  if (series && (kind === "pie" || kind === "funnel")) series = series.slice(0, 1);
  const valid = categories !== null && series !== null;
  return {
    valid,
    kind,
    size: chartSize(props),
    title: text(props.title),
    categoryLabel: text(props.categoryLabel) || "Category",
    categories: valid ? categories! : [],
    series: valid ? series!.map((s) => ({ name: s.name, values: categories!.map((_, i) => s.values[i] ?? null) })) : [],
    spec: formatSpec(props),
    empty: emptyText(props),
  };
}

export function chartCell(model: ChartModel, v: number | null): string {
  return v === null ? "" : formatNumber(v, model.spec);
}

// ── kpi ──────────────────────────────────────────────────────────────────────

export type Trend = "up" | "down" | "flat";
export interface KpiModel {
  label: string;
  value: string | null;
  delta: { text: string; trend: Trend; tone: "positive" | "negative" | "neutral"; word: string } | null;
  empty: string;
}

const TREND_WORDS: Record<Trend, string> = { up: "Up", down: "Down", flat: "No change" };

export function kpiModel(props: Props): KpiModel {
  const n = toNumber(props.value);
  const label = text(props.label);
  if (n === null) return { label, value: null, delta: null, empty: emptyText(props) };
  const value = formatNumber(n, formatSpec(props));
  const d = toNumber(props.delta);
  if (d === null) return { label, value, delta: null, empty: emptyText(props) };
  const deltaSpec = formatSpec({ format: props.deltaFormat, currency: props.currency, decimals: props.deltaDecimals }, "percent");
  const trend: Trend = oneOf(props.trend, ["up", "down", "flat"] as const, d > 0 ? "up" : d < 0 ? "down" : "flat");
  const good = oneOf(props.goodDirection, ["up", "down"] as const, "up");
  const tone = trend === "flat" ? "neutral" : trend === good ? "positive" : "negative";
  return { label, value, delta: { text: signedNumber(d, deltaSpec), trend, tone, word: TREND_WORDS[trend] }, empty: emptyText(props) };
}

// ── table ────────────────────────────────────────────────────────────────────

const TOTALS = ["sum", "avg", "min", "max", "count"] as const;
type Total = (typeof TOTALS)[number];

export interface TableColumn {
  key: string;
  label: string;
  spec: NumberFormatSpec | null;
  align: "start" | "center" | "end";
  total: Total | null;
}
export interface TableModel {
  valid: boolean;
  caption: string;
  columns: TableColumn[];
  rows: string[][];
  sort: { key: string; dir: "asc" | "desc" } | null;
  totals: string[] | null;
  empty: string;
}

export function tableLabel(props: Props): string {
  return text(props.caption) || "Table";
}

function tableColumns(raw: unknown): TableColumn[] {
  if (!Array.isArray(raw)) return [];
  const out: TableColumn[] = [];
  for (const c of raw) {
    if (!isRecord(c)) continue;
    const key = own(c, "key");
    if (typeof key !== "string" || key === "") continue;
    const label = own(c, "label");
    const format = own(c, "format");
    const spec = typeof format === "string" && ["number", "currency", "percent"].includes(format) ? formatSpec({ format, currency: own(c, "currency"), decimals: own(c, "decimals") }) : null;
    out.push({
      key,
      label: typeof label === "string" && label !== "" ? label : key,
      spec,
      align: oneOf(own(c, "align"), ["start", "center", "end"] as const, spec ? "end" : "start"),
      total: oneOf<Total | "">(own(c, "total"), TOTALS, "") || null,
    });
  }
  return out;
}

interface SortValue {
  rank: number;
  num: number;
  str: string;
}
function sortValue(v: unknown): SortValue {
  const n = toNumber(v);
  if (n !== null) return { rank: 0, num: n, str: "" };
  if (typeof v === "string") return { rank: 1, num: 0, str: v };
  return { rank: 2, num: 0, str: "" };
}

export function tableModel(props: Props): TableModel {
  const caption = text(props.caption);
  const columns = tableColumns(props.columns);
  const rawRows = props.rows;
  const records = Array.isArray(rawRows) ? rawRows.filter(isRecord) : [];
  const invalid = { valid: false, caption, columns: [], rows: [], sort: null, totals: null, empty: emptyText(props) };
  if (columns.length === 0 || records.length === 0) return invalid;

  const s = props.sort;
  const sortKey = isRecord(s) ? own(s, "key") : undefined;
  const sort = typeof sortKey === "string" && columns.some((c) => c.key === sortKey) ? { key: sortKey, dir: own(s as Record<string, unknown>, "dir") === "desc" ? ("desc" as const) : ("asc" as const) } : null;

  let ordered = records;
  if (sort) {
    const decorated = records.map((row, index) => ({ row, index, v: sortValue(own(row, sort.key)) }));
    decorated.sort((a, b) => {
      if (a.v.rank !== b.v.rank) return a.v.rank - b.v.rank;
      let c = a.v.rank === 0 ? (a.v.num < b.v.num ? -1 : a.v.num > b.v.num ? 1 : 0) : a.v.rank === 1 ? compareStrings(a.v.str, b.v.str) : 0;
      if (sort.dir === "desc") c = -c;
      return c !== 0 ? c : a.index - b.index;
    });
    ordered = decorated.map((d) => d.row);
  }

  const cell = (col: TableColumn, v: unknown): string => {
    if (col.spec) {
      const n = toNumber(v);
      if (n !== null) return formatNumber(n, col.spec);
    }
    return cellText(v);
  };

  let totals: string[] | null = null;
  if (props.totals === true) {
    const label = text(props.totalsLabel) || "Total";
    totals = columns.map((col, i) => {
      if (!col.total) return i === 0 ? label : "";
      if (col.total === "count") return formatNumber(ordered.length, formatSpec({}));
      const nums: number[] = [];
      for (const row of ordered) {
        const n = toNumber(own(row, col.key));
        if (n !== null) nums.push(n);
      }
      if (nums.length === 0) return "";
      let value: number;
      if (col.total === "min") value = Math.min(...nums);
      else if (col.total === "max") value = Math.max(...nums);
      else {
        let sum = 0;
        for (const n of nums) sum += n;
        value = col.total === "avg" ? sum / nums.length : sum;
      }
      return formatNumber(value, col.spec ?? formatSpec({}));
    });
  }

  return {
    valid: true,
    caption,
    columns,
    rows: ordered.map((row) => columns.map((col) => cell(col, own(row, col.key)))),
    sort,
    totals,
    empty: emptyText(props),
  };
}

// ── leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  label: string;
  value: string;
}
export interface LeaderboardModel {
  valid: boolean;
  entries: LeaderboardEntry[];
  empty: string;
}

export function leaderboardModel(props: Props): LeaderboardModel {
  const labelKey = text(props.labelKey) || "name";
  const valueKey = text(props.valueKey) || "value";
  const asc = props.order === "asc";
  const limit = typeof props.limit === "number" && Number.isInteger(props.limit) && props.limit >= 1 && props.limit <= 100 ? props.limit : 10;
  const spec = formatSpec(props);
  const rows = Array.isArray(props.rows) ? props.rows : [];
  const ranked: { label: string; n: number; index: number }[] = [];
  for (const [index, row] of rows.entries()) {
    if (!isRecord(row)) continue;
    const n = toNumber(own(row, valueKey));
    if (n === null) continue;
    ranked.push({ label: cellText(own(row, labelKey)), n, index });
  }
  ranked.sort((a, b) => {
    const c = a.n < b.n ? -1 : a.n > b.n ? 1 : 0;
    return (asc ? c : -c) || a.index - b.index;
  });
  const entries: LeaderboardEntry[] = [];
  for (const [i, r] of ranked.entries()) {
    const rank = i > 0 && r.n === ranked[i - 1]!.n ? entries[i - 1]!.rank : i + 1;
    entries.push({ rank, label: r.label, value: formatNumber(r.n, spec) });
  }
  return { valid: entries.length > 0, entries: entries.slice(0, limit), empty: emptyText(props) };
}

// ── shared stylesheet ────────────────────────────────────────────────────────

/**
 * Emitted after the base stylesheet, and only by documents that use an
 * infographic node (`emitDocCss`). Mirrored byte-for-byte by the PHP emitter.
 *
 * Light, dark (`.dark` / `[data-theme="dark"]`, the kit's class strategy) and
 * print. Colours are theme tokens with fallbacks: `--cms-color-positive`,
 * `--cms-color-negative` and `--cms-color-primary`, each with a `-dark`
 * variant, and `--cms-chart-1` … `--cms-chart-6` for the chart palette, which
 * the chart island reads off its figure so canvas and page agree. Lines and
 * muted text mix `currentColor`, so they follow whatever text colour the page
 * sets. Print hides the chart canvas and prints its data table.
 */
export const INFOGRAPHIC_CSS = `/* fancy-cms infographics */

:where([data-cms-kpi], [data-cms-table], [data-cms-leaderboard], figure[data-cms-chart]) {
  --cms-ig-down: var(--cms-color-negative, #b91c1c);
  --cms-ig-muted: color-mix(in srgb, currentColor 70%, transparent);
  --cms-ig-rule: color-mix(in srgb, currentColor 20%, transparent);
  --cms-ig-up: var(--cms-color-positive, #15803d);
}

:where(figure[data-cms-chart]) {
  --cms-chart-1: var(--cms-color-primary, #7c3aed);
  --cms-chart-2: var(--cms-chart-teal, #0f766e);
  --cms-chart-3: var(--cms-chart-orange, #c2410c);
  --cms-chart-4: var(--cms-chart-blue, #1d4ed8);
  --cms-chart-5: var(--cms-chart-pink, #be185d);
  --cms-chart-6: var(--cms-chart-lime, #4d7c0f);
  margin: 0;
}

:where(.dark, [data-theme="dark"]) :where([data-cms-kpi], [data-cms-table], [data-cms-leaderboard], figure[data-cms-chart]) {
  --cms-ig-down: var(--cms-color-negative-dark, #f87171);
  --cms-ig-up: var(--cms-color-positive-dark, #4ade80);
}

:where(.dark, [data-theme="dark"]) :where(figure[data-cms-chart]) {
  --cms-chart-1: var(--cms-color-primary-dark, #a78bfa);
  --cms-chart-2: var(--cms-chart-teal-dark, #2dd4bf);
  --cms-chart-3: var(--cms-chart-orange-dark, #fb923c);
  --cms-chart-4: var(--cms-chart-blue-dark, #60a5fa);
  --cms-chart-5: var(--cms-chart-pink-dark, #f472b6);
  --cms-chart-6: var(--cms-chart-lime-dark, #a3e635);
}

:where([data-cms-sr]) {
  border: 0;
  clip-path: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

:where([data-cms-empty]) {
  border: 1px dashed var(--cms-ig-rule);
  border-radius: 8px;
  color: var(--cms-ig-muted);
  font-size: 0.875em;
  margin: 0;
  padding: 16px;
  text-align: center;
}

:where([data-cms-kpi]) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:where([data-cms-kpi] > p) {
  margin: 0;
}

:where([data-cms-kpi-label]) {
  color: var(--cms-ig-muted);
  font-size: 0.875em;
}

:where([data-cms-kpi-value]) {
  font-size: 2em;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

:where([data-cms-kpi-delta]) {
  align-items: center;
  display: inline-flex;
  font-size: 0.875em;
  font-weight: 600;
  gap: 6px;
}

:where([data-cms-kpi-delta])::before {
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  content: "";
}

:where([data-cms-kpi-trend="up"])::before {
  border-bottom: 7px solid currentColor;
}

:where([data-cms-kpi-trend="down"])::before {
  border-top: 7px solid currentColor;
}

:where([data-cms-kpi-trend="flat"])::before {
  border: 0;
  border-top: 2px solid currentColor;
  width: 8px;
}

:where([data-cms-kpi-tone="positive"]) {
  color: var(--cms-ig-up);
}

:where([data-cms-kpi-tone="negative"]) {
  color: var(--cms-ig-down);
}

:where([data-cms-table]) {
  max-width: 100%;
  overflow-x: auto;
}

:where([data-cms-table]:focus-visible) {
  outline: 2px solid var(--cms-color-primary, #7c3aed);
  outline-offset: 2px;
}

:where([data-cms-table] table, figure[data-cms-chart] table) {
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  width: 100%;
}

:where(figure[data-cms-chart] table[data-cms-sr]) {
  width: 1px;
}

:where([data-cms-table] caption) {
  caption-side: top;
  color: var(--cms-ig-muted);
  font-size: 0.875em;
  padding-bottom: 8px;
  text-align: left;
}

:where([data-cms-table] th, [data-cms-table] td, figure[data-cms-chart] th, figure[data-cms-chart] td) {
  border-bottom: 1px solid var(--cms-ig-rule);
  padding: 8px 12px;
  text-align: left;
}

:where([data-cms-table] thead th, figure[data-cms-chart] thead th) {
  font-weight: 600;
}

:where([data-cms-table] tfoot td) {
  border-bottom: 0;
  border-top: 2px solid var(--cms-ig-rule);
  font-weight: 600;
}

:where(figure[data-cms-chart] td, [data-cms-align="end"]) {
  text-align: right;
}

:where([data-cms-align="center"]) {
  text-align: center;
}

:where([data-cms-leaderboard] ol) {
  list-style: none;
  margin: 0;
  padding: 0;
}

:where([data-cms-leaderboard] li) {
  align-items: baseline;
  border-bottom: 1px solid var(--cms-ig-rule);
  display: flex;
  gap: 12px;
  padding: 8px 0;
}

:where([data-cms-lb="rank"]) {
  color: var(--cms-ig-muted);
  font-variant-numeric: tabular-nums;
  min-width: 2ch;
  text-align: right;
}

:where([data-cms-rank="1"] [data-cms-lb="rank"]) {
  font-weight: 700;
}

:where([data-cms-lb="label"]) {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

:where([data-cms-lb="value"]) {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

:where(figure[data-cms-chart] figcaption) {
  font-weight: 600;
  margin-bottom: 8px;
}

:where([data-cms-chart-canvas]) {
  height: 320px;
  width: 100%;
}

:where([data-cms-chart-size="sm"] [data-cms-chart-canvas]) {
  height: 220px;
}

:where([data-cms-chart-size="lg"] [data-cms-chart-canvas]) {
  height: 420px;
}

@media print {
  :where([data-cms-chart-canvas]) {
    display: none;
  }

  :where([data-cms-chart-data][data-cms-sr]) {
    clip-path: none;
    height: auto;
    margin: 0;
    overflow: visible;
    position: static;
    white-space: normal;
    width: 100%;
  }

  :where([data-cms-table]) {
    overflow: visible;
  }

  :where([data-cms-kpi], [data-cms-table], [data-cms-leaderboard], figure[data-cms-chart]) {
    break-inside: avoid;
  }
}`;
