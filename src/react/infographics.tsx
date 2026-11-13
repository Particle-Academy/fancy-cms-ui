/**
 * React renderers for the infographic kit. Each returns the INNER content of
 * its `[data-cms]` element (registry.tsx `elementFor` supplies the element), and
 * every byte must match `FancyCms\Render\Infographics` — so adjacent text is
 * always joined into one string (React separates two text children with a
 * `<!-- -->` comment the PHP renderer would not write).
 */
import { useRef, useState, type ReactElement, type ReactNode } from "react";
import type { ElementContext } from "./registry";
import { IslandBoundary, resolvedProps, useIsland } from "./islands";
import { chartCell, chartModel, kpiModel, leaderboardModel, tableModel } from "../render/infographics";
// A long token may break anywhere; ordinary values and labels keep their min-content.
import { hasLongToken } from "../render/wrap";

const empty = (text: string) => <p data-cms-empty="">{text}</p>;
const align = (a: "start" | "center" | "end") => (a === "start" ? undefined : a);

export function renderKpi(ctx: ElementContext): ReactNode {
  const m = kpiModel(resolvedProps(ctx));
  return (
    <>
      {m.label ? <p data-cms-kpi-label="">{m.label}</p> : null}
      {m.value === null ? empty(m.empty) : <p data-cms-kpi-value="" data-cms-wrap={hasLongToken(m.value) ? "anywhere" : undefined}>{m.value}</p>}
      {m.delta ? (
        <p data-cms-kpi-delta="" data-cms-kpi-trend={m.delta.trend} data-cms-kpi-tone={m.delta.tone}>
          <span data-cms-sr="">{m.delta.word}</span>
          {" " + m.delta.text}
        </p>
      ) : null}
    </>
  );
}

export function renderTable(ctx: ElementContext): ReactNode {
  const m = tableModel(resolvedProps(ctx));
  if (!m.valid) return empty(m.empty);
  return (
    <table>
      {m.caption ? <caption>{m.caption}</caption> : null}
      <thead>
        <tr>
          {m.columns.map((c, i) => (
            <th key={i} scope="col" aria-sort={m.sort?.key === c.key ? (m.sort.dir === "desc" ? "descending" : "ascending") : undefined} data-cms-align={align(c.align)}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {m.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} data-cms-align={align(m.columns[j]!.align)}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {m.totals ? (
        <tfoot>
          <tr>
            {m.totals.map((cell, j) => (
              <td key={j} data-cms-align={align(m.columns[j]!.align)}>
                {cell}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

export function renderLeaderboard(ctx: ElementContext): ReactNode {
  const m = leaderboardModel(resolvedProps(ctx));
  if (!m.valid) return empty(m.empty);
  return (
    <ol>
      {m.entries.map((e, i) => (
        <li key={i} data-cms-rank={String(e.rank)}>
          <span data-cms-lb="rank">{String(e.rank)}</span>
          <span data-cms-lb="label" data-cms-wrap={hasLongToken(e.label) ? "anywhere" : undefined}>{e.label}</span>
          <span data-cms-lb="value">{e.value}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The chart's figure content. The server (and the first client render) gets the
 * accessible data table; in the browser, once the chart island has loaded, the
 * canvas appears above it and the table becomes visually hidden but stays for
 * assistive technology and print. No data means no table, no canvas, and the
 * chart library is never requested.
 */
function ChartFigure({ ctx }: { ctx: ElementContext }): ReactElement {
  const props = resolvedProps(ctx);
  const m = chartModel(props);
  const tableRef = useRef<HTMLTableElement>(null);
  const load = ctx.islands?.chart?.load;
  const Canvas = useIsland(load, m.valid, tableRef);
  const [failed, setFailed] = useState(false);
  const live = Canvas !== null && !failed;
  return (
    <>
      {m.title ? <figcaption>{m.title}</figcaption> : null}
      {live ? (
        <IslandBoundary onError={() => setFailed(true)}>
          <div data-cms-chart-canvas="" aria-hidden="true">
            <Canvas props={props} node={ctx.node} data={ctx.data} />
          </div>
        </IslandBoundary>
      ) : null}
      {m.valid ? (
        <table ref={tableRef} data-cms-chart-data="" data-cms-sr={live ? "" : undefined}>
          <thead>
            <tr>
              <th scope="col">{m.categoryLabel}</th>
              {m.series.map((s, i) => (
                <th key={i} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.categories.map((cat, i) => (
              <tr key={i}>
                <th scope="row">{cat}</th>
                {m.series.map((s, j) => (
                  <td key={j}>{chartCell(m, s.values[i] ?? null)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        empty(m.empty)
      )}
    </>
  );
}

export function renderChart(ctx: ElementContext): ReactNode {
  return <ChartFigure ctx={ctx} />;
}
