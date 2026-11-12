/**
 * Page inputs in React: the state `CmsPage` keeps, the data re-request, and the
 * `input` node renderer.
 *
 * Server and first paint render native, labelled form controls whose bytes
 * match the PHP renderer (`FancyCms\Render\Inputs`). In the browser the input
 * island (src/islands/inputs.tsx) loads react-fancy's Select, CheckboxGroup and
 * DatePicker as a separate chunk and takes over the same element ids. The
 * native controls work until it arrives, so an early change is never lost.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ComponentType, type ReactElement, type ReactNode } from "react";
import type { PageDoc } from "../document/types";
import { dataQueries, type DataQuery } from "../document/data";
import type { DataContext, ElementContext } from "./registry";
import { IslandBoundary, resolvedProps, useIsland } from "./islands";
import { inputModel, inputValues, pageInputs, type DateRange, type InputModel, type InputValue, type InputValues } from "../render/inputs";

/**
 * Called with the page's input values whenever one changes, and the queries
 * those values make (`dataQueries`: each stream, alias, params and scope, with
 * every `{ "$input" }` filled in). Resolves to the data context to render
 * with: each query's result under its `key`.
 */
export type InputDataLoader = (values: InputValues, request: { signal: AbortSignal; queries: DataQuery[] }) => Promise<DataContext> | DataContext;

export interface PageInputProps {
  /** Controlled input values, by input name. Normalised before use. */
  inputs?: Record<string, unknown>;
  /** Initial values when uncontrolled (for example parsed from the URL with `inputsFromQuery`). */
  defaultInputs?: Record<string, unknown>;
  /** Every change, with all the page's values and the name that changed. */
  onInputsChange?: (values: InputValues, changed: string) => void;
  /**
   * Re-request the data context for new input values. The page keeps showing
   * its current data until the answer arrives; only the latest answer is used.
   */
  loadData?: InputDataLoader;
}

interface InputsState {
  values: InputValues;
  set: (name: string, value: InputValue) => void;
}

const InputsContext = createContext<InputsState | null>(null);

function isRecord(v: unknown): v is DataContext {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * The page's input values and the data to render with. `data` is the host's;
 * an answer from `loadData` replaces it until the host passes new `data`.
 */
export function usePageInputs(doc: PageDoc, data: DataContext | undefined, props: PageInputProps): { data: DataContext | undefined; state: InputsState } {
  const { inputs, defaultInputs, onInputsChange, loadData } = props;
  const [internal, setInternal] = useState<Record<string, unknown>>(() => defaultInputs ?? {});
  const [loaded, setLoaded] = useState<{ base: DataContext | undefined; data: DataContext } | null>(null);
  const effective = loaded && loaded.base === data ? loaded.data : data;
  const raw = inputs ?? internal;
  const values = useMemo(() => inputValues(doc, raw, effective), [doc, raw, effective]);
  const key = JSON.stringify(values);

  // The values the current data answers: the first render's (the host's data
  // was fetched for them), then each loaded answer's.
  const settled = useRef(key);
  const latest = useRef({ doc, values, data, loadData });
  latest.current = { doc, values, data, loadData };

  useEffect(() => {
    const { doc: page, loadData: load, values: asked, data: base } = latest.current;
    if (!load || settled.current === key) return;
    const controller = new AbortController();
    let live = true;
    const queries = dataQueries(page, { inputs: asked, data: base });
    Promise.resolve()
      .then(() => load(asked, { signal: controller.signal, queries }))
      .then(
        (next) => {
          if (!live) return;
          settled.current = key;
          if (isRecord(next)) setLoaded({ base, data: next });
        },
        (error: unknown) => {
          if (live) console.warn("[fancy-cms] loadData failed; the page keeps its current data.", error);
        },
      );
    return () => {
      live = false;
      controller.abort();
    };
  }, [key]);

  const state = useMemo<InputsState>(
    () => ({
      values,
      set: (name, value) => {
        const next = { ...values, [name]: value };
        if (inputs === undefined) setInternal(next);
        onInputsChange?.(inputValues(doc, next, effective), name);
      },
    }),
    [values, inputs, onInputsChange, doc, effective],
  );
  return { data: effective, state };
}

export function InputsProvider({ state, children }: { state: InputsState; children: ReactNode }): ReactElement {
  return <InputsContext.Provider value={state}>{children}</InputsContext.Provider>;
}

/** What the input island's module renders: react-fancy controls over the same model. */
export interface InputControlProps {
  model: InputModel;
  onChange: (value: InputValue) => void;
}
export interface InputControlModule {
  default: ComponentType<InputControlProps>;
}

const empty = (text: string) => <p data-cms-empty="">{text}</p>;

/** The native controls: the server's markup, and the page's controls until react-fancy's load. */
function NativeControls({ model, onChange }: InputControlProps): ReactElement {
  const id = `cms-input-${model.name}`;
  if (model.kind === "multiselect") {
    const picked = model.value as string[];
    return (
      <fieldset>
        <legend>{model.label}</legend>
        {model.options.map((o) => (
          <label key={o.value}>
            <input
              type="checkbox"
              name={`${model.name}[]`}
              value={o.value}
              checked={picked.includes(o.value)}
              onChange={(e) => onChange(model.options.filter((x) => (x.value === o.value ? e.target.checked : picked.includes(x.value))).map((x) => x.value))}
            />
            {o.label}
          </label>
        ))}
      </fieldset>
    );
  }
  if (model.kind === "daterange") {
    const range = model.value as DateRange;
    return (
      <fieldset>
        <legend>{model.label}</legend>
        <label htmlFor={`${id}-from`}>{model.fromLabel}</label>
        <input type="date" id={`${id}-from`} name={`${model.name}[from]`} value={range.from} onChange={(e) => onChange({ from: e.target.value, to: range.to })} />
        <label htmlFor={`${id}-to`}>{model.toLabel}</label>
        <input type="date" id={`${id}-to`} name={`${model.name}[to]`} value={range.to} onChange={(e) => onChange({ from: range.from, to: e.target.value })} />
      </fieldset>
    );
  }
  return (
    <>
      <label htmlFor={id}>{model.label}</label>
      <select id={id} name={model.name} value={model.value as string} onChange={(e) => onChange(e.target.value)}>
        {model.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );
}

function InputNode({ ctx }: { ctx: ElementContext }): ReactElement {
  const page = useContext(InputsContext);
  const props = resolvedProps(ctx);
  const name = typeof props.name === "string" ? props.name : "";
  const declared = pageInputs(ctx.doc).some((d) => d.node === ctx.node.id && d.name === name);
  const [local, setLocal] = useState<InputValue | undefined>(undefined);
  const raw = page ? page.values[name] : local;
  const model = inputModel(props, raw, declared);
  const load = ctx.islands?.input?.load as unknown as (() => Promise<InputControlModule>) | undefined;
  const Live = useIsland(load, model.valid);
  const [failed, setFailed] = useState(false);
  if (!model.valid) return empty(model.empty);
  const onChange = (value: InputValue) => (page ? page.set(name, value) : setLocal(value));
  if (Live && !failed) {
    return (
      <IslandBoundary onError={() => setFailed(true)}>
        <Live model={model} onChange={onChange} />
      </IslandBoundary>
    );
  }
  return <NativeControls model={model} onChange={onChange} />;
}

export function renderInput(ctx: ElementContext): ReactNode {
  return <InputNode ctx={ctx} />;
}
