"use client";

// Token usage as OpenAI reported it, and the cost estimated from config/openai-pricing.json.
import { useRef } from "react";
import { fmt } from "./shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Totals = {
  requests: number; inputTokens: number; outputTokens: number; totalTokens: number; cachedInputTokens: number;
  cost: number; unavailable: number; unpriced: number;
};

export const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString());
const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: n > 0 && n < 0.01 ? 4 : 2, maximumFractionDigits: n > 0 && n < 0.01 ? 4 : 2 }).format(n);

/** The cost is only what could be priced; say so when some requests could not be. */
function Cost({ t, currency }: { t: Totals; currency: string }) {
  const priced = t.requests - t.unavailable - t.unpriced;
  if (t.requests && !priced) return <span className="muted">Not priced</span>;
  return <>{money(t.cost, currency)}{t.unpriced > 0 && <span className="muted small"> + {t.unpriced} unpriced</span>}</>;
}

function Caveats({ t, pricing }: { t: Totals; pricing: any }) {
  return (
    <p className="muted small">
      Token counts are the ones OpenAI returned with each response; cost is an estimate from <code>config/openai-pricing.json</code> ({pricing.currency}).
      {t.unavailable > 0 && ` ${t.unavailable} request${t.unavailable === 1 ? "" : "s"} came back without usage data and ${t.unavailable === 1 ? "is" : "are"} counted as unavailable, not guessed.`}
      {t.unpriced > 0 && ` ${t.unpriced} request${t.unpriced === 1 ? " uses a model" : "s use models"} with no configured price.`}
      {" "}Answers replayed from the local cache make no request and are not counted.
    </p>
  );
}

function Stats({ t, currency }: { t: Totals; currency: string }) {
  return (
    <div className="stat-row usage-stats">
      <div className="stat"><b>{tokens(t.totalTokens)}</b><span>Total tokens</span></div>
      <div className="stat"><b>{tokens(t.inputTokens)}</b><span>Input{t.cachedInputTokens > 0 ? `, ${tokens(t.cachedInputTokens)} cached` : ""}</span></div>
      <div className="stat"><b>{tokens(t.outputTokens)}</b><span>Output</span></div>
      <div className="stat"><b><Cost t={t} currency={currency} /></b><span>Estimated cost · {t.requests} requests</span></div>
    </div>
  );
}

function GroupTable({ rows, first, currency, onOpen }: { rows: any[]; first: string; currency: string; onOpen?: (r: any) => void }) {
  if (!rows.length) return null;
  return (
    <div className="table-wrap">
      <table className="usage-table">
        <thead><tr><th>{first}</th><th>Requests</th><th>Input</th><th>Output</th><th>Total</th><th>Cost</th></tr></thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.key}>
              <td>{onOpen ? <button className="link" onClick={() => onOpen(g)}>{g.label ?? g.key}</button> : g.label ?? g.key}</td>
              <td>{g.requests}{g.unavailable > 0 && <span className="muted small"> ({g.unavailable} n/a)</span>}</td>
              <td>{tokens(g.inputTokens)}</td>
              <td>{tokens(g.outputTokens)}</td>
              <td><b>{tokens(g.totalTokens)}</b></td>
              <td><Cost t={g} currency={currency} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The AI usage page: everything used so far, across all requirements. */
export function UsageDashboard({ usage, onOpen }: { usage: any; onOpen: (id: number) => void }) {
  const t: Totals = usage.totals;
  const currency = usage.pricing.currency;
  return (
    <div className="card usage-dashboard">
      <h2>AI token usage</h2>
      {t.requests === 0 ? (
        <p className="muted">No OpenAI requests recorded yet. Usage is tracked from the first interview question on.</p>
      ) : (
        <>
          <Stats t={t} currency={currency} />
          <h4>By process</h4>
          <GroupTable rows={usage.byProcess} first="Process" currency={currency} />
          <h4>By requirement</h4>
          <GroupTable rows={usage.byRequirement.map((g: any) => ({ ...g, label: `REQ-${g.id} · ${g.title}` }))} first="Requirement" currency={currency} onOpen={(g) => onOpen(g.id)} />
          <h4>By model</h4>
          <GroupTable rows={usage.byModel} first="Model" currency={currency} />
          <Caveats t={t} pricing={usage.pricing} />
        </>
      )}
    </div>
  );
}

/** Top bar: the running total, always in view; opens the AI usage page. */
export function UsageChip({ usage }: { usage: any }) {
  const t: Totals = usage.totals;
  return (
    <a href="/usage" className="chip usage-chip" title={`${t.requests} OpenAI requests · ${t.inputTokens.toLocaleString()} input and ${t.outputTokens.toLocaleString()} output tokens. Open AI usage.`}>
      {tokens(t.totalTokens)} tokens · <Cost t={t} currency={usage.pricing.currency} />
    </a>
  );
}

/** Right rail of one requirement: its totals, with the per-version and per-request detail in a dialog. */
export function RequirementUsage({ usage }: { usage: any }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const t: Totals = usage.totals;
  const currency = usage.pricing.currency;
  const versionRows = [
    ...(usage.beforeFs.requests ? [{ key: "interview", label: "Interview (before any FS)", ...usage.beforeFs }] : []),
    ...usage.byVersion.filter((v: any) => v.requests).map((v: any) => ({ ...v, key: String(v.id), label: `${v.doc_type} v${v.label} · ${v.status.toLowerCase()}` })),
    ...(usage.code.requests ? [{ key: "code", label: "ABAP code and review", ...usage.code }] : []),
  ];
  return (
    <div className="card side">
      <h4>AI usage</h4>
      {t.requests === 0 ? (
        <p className="muted small">No OpenAI requests for this requirement yet.</p>
      ) : (
        <>
          <p className="usage-line"><b>{tokens(t.totalTokens)}</b> tokens · <Cost t={t} currency={currency} /></p>
          <p className="muted small">{tokens(t.inputTokens)} in · {tokens(t.outputTokens)} out · {t.requests} requests{t.unavailable ? ` · ${t.unavailable} without usage data` : ""}</p>
          <button className="quiet" onClick={() => dialog.current?.showModal()}>Token usage details</button>
        </>
      )}
      <dialog ref={dialog} className="audit-dialog" aria-label="Token usage">
        <div className="row tight between">
          <h2>Token usage</h2>
          <button className="secondary small-btn" onClick={() => dialog.current?.close()}>Close</button>
        </div>
        <Stats t={t} currency={currency} />
        <h4>By document version</h4>
        <GroupTable rows={versionRows} first="Version" currency={currency} />
        <h4>By process</h4>
        <GroupTable rows={usage.byProcess} first="Process" currency={currency} />
        <h4>Every request</h4>
        <div className="table-wrap">
          <table className="usage-table">
            <thead><tr><th>When</th><th>Process</th><th>Document</th><th>Model</th><th>Input</th><th>Output</th><th>Total</th><th>Cost</th><th>OpenAI request ID</th></tr></thead>
            <tbody>
              {usage.requests.map((q: any) => (
                <tr key={q.id}>
                  <td>{fmt(q.requested_at)}</td>
                  <td>{q.processLabel}{q.attempt > 1 && <span className="muted small"> (retry {q.attempt - 1})</span>}<div className="muted small">{q.actor}</div></td>
                  <td>{q.code_version_id ? `Code${q.version ? `, from FS v${q.version.label}` : ""}` : q.version ? `${q.version.doc_type} v${q.version.label}` : "Interview"}</td>
                  <td className="mono small">{q.model ?? q.requested_model}</td>
                  {q.usage_available ? (
                    <>
                      <td>{q.input_tokens?.toLocaleString()}{q.cached_input_tokens ? <div className="muted small">{q.cached_input_tokens.toLocaleString()} cached</div> : null}</td>
                      <td>{q.output_tokens?.toLocaleString()}</td>
                      <td><b>{q.total_tokens?.toLocaleString()}</b></td>
                      <td>{q.cost === null ? <span className="muted">Not priced</span> : money(q.cost, currency)}</td>
                    </>
                  ) : (
                    <td colSpan={4} className="muted">Usage unavailable: the response had no usage data</td>
                  )}
                  <td className="mono small">{q.request_id ?? <span className="muted">none returned</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Caveats t={t} pricing={usage.pricing} />
      </dialog>
    </div>
  );
}

/** One line on a version card in the rail. */
export function versionUsage(usage: any, id: number) {
  const v = usage?.byVersion?.find((x: any) => x.id === id);
  return v?.requests ? `${tokens(v.totalTokens)} tokens` : null;
}
