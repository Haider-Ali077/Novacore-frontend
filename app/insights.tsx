"use client";

// The right panel's first card, the same for all six WRICEF types: the AI's suggested category and its
// confidence, mandatory information still missing, coverage, source traceability of the FS, and whether
// the next step is open. Everything here is derived from the page state; nothing is decided here.
import { fromRgType, wricefLabel } from "@/lib/wricef";
import { fsTraceability, mandatoryGaps } from "@/lib/validation";
import type { StepProps } from "./shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

const suggestedLabel = (s: string) => (s === "MIXED" ? "Mixed" : s === "UNCLEAR" ? "Unclear" : wricefLabel(s));

export function Insights({ state, busy, run }: Pick<StepProps, "state" | "busy" | "run">) {
  const r = state.requirement;
  const c = r.classification;
  const rgType = fromRgType(r.wricef);
  const summary = r.summary;
  const gaps = summary ? mandatoryGaps(r.wricef, summary) : ((r.interview?.mandatory_missing as string[]) ?? []);
  const coverage: any[] = r.interview?.coverage ?? [];
  const tracked: any[] = r.interview?.tracked ?? [];
  const count = (list: any[], key: string, value: string) => list.filter((x) => x[key] === value).length;
  const trace = state.fsd ? fsTraceability(state.fsd.markdown, r.wricef) : null;
  const differs = c && !c.error && c.suggested && c.suggested !== r.wricef && c.suggested !== "UNCLEAR";
  const switchable = differs && !rgType && (c.suggested === "R" || c.suggested === "W");
  const change = () => {
    const to = wricefLabel(c.suggested);
    if (!confirm(`Change this requirement from ${wricefLabel(r.wricef)} to ${to}?\n\nThe interview restarts with ${to.toLowerCase()} questions. Existing document versions stay in the history.`)) return;
    run("changeWricef", `Re-checking the requirement as a ${to.toLowerCase()}`, { wricef: c.suggested, confirmed: true });
  };
  const blocker = !summary
    ? "The interview is still running."
    : gaps.length
      ? `Blocked: ${gaps.length} mandatory ${gaps.length === 1 ? "item" : "items"} missing.`
      : state.fsd
        ? trace?.applicable && trace.unsourced.length
          ? `${trace.unsourced.length} FS ${trace.unsourced.length === 1 ? "row has" : "rows have"} no source. Review before approval.`
          : "FS written; no validation issues."
        : "Ready to write the FS.";

  return (
    <div className="card side insights">
      <h4>AI insights</h4>

      <section>
        <h5>Suggested category</h5>
        {!c ? (
          <p className="muted small">Not classified yet.</p>
        ) : c.error ? (
          <p className="warn small">Classification failed: {c.error}</p>
        ) : (
          <>
            <p className="classification-line">
              <b>{suggestedLabel(c.suggested)}</b>
              <span className={`pill ${c.confidence >= 0.75 ? "good" : c.confidence >= 0.5 ? "draft" : "bad"}`}>{Math.round(c.confidence * 100)}% confidence</span>
            </p>
            <p className="muted small">{c.explanation}</p>
            {c.other_parts?.length > 0 && (
              <p className="muted small">Also contains: {c.other_parts.map((o: any) => `${wricefLabel(o.category)} (${o.reason})`).join("; ")}</p>
            )}
            {r.categoryBlock && (
              <p className="warn small">Blocked: this requirement cannot continue as a {wricefLabel(r.wricef)}. The notice in the main panel shows what to do.</p>
            )}
            {differs && !r.categoryBlock && (
              <div className="notice block small">
                The AI suggests <b>{suggestedLabel(c.suggested)}</b>, but this requirement is a <b>{wricefLabel(r.wricef)}</b>. Your selection is kept.
                {switchable
                  ? <div className="row"><button className="secondary small-btn" onClick={change} disabled={busy}>Change to {wricefLabel(c.suggested)}</button></div>
                  : c.suggested !== "MIXED" && <> If the AI is right, start a new requirement as {suggestedLabel(c.suggested)}.</>}
              </div>
            )}
          </>
        )}
        <button className="quiet small" onClick={() => run("classify", "Classifier agent is reading the requirement")} disabled={busy}>Classify again</button>
      </section>

      <section>
        <h5>Missing mandatory information</h5>
        {gaps.length ? (
          <ul className="gaps">{gaps.map((g) => <li key={g}>{g}</li>)}</ul>
        ) : (
          <p className="muted small">{summary || r.interview?.mandatory_missing ? "None." : "Checked as the interview goes."}</p>
        )}
      </section>

      {(coverage.length > 0 || tracked.length > 0) && (
        <section>
          <h5>Coverage</h5>
          <p className="small">
            {tracked.length > 0 ? (
              <>
                <span className="pill good">{count(tracked, "status", "confirmed")} confirmed</span>{" "}
                <span className="pill draft">{count(tracked, "status", "open")} open</span>{" "}
                {count(tracked, "status", "conflict") > 0 && <span className="pill bad">{count(tracked, "status", "conflict")} in conflict</span>}
              </>
            ) : (
              <>
                <span className="pill good">{count(coverage, "state", "answered")} answered</span>{" "}
                <span className="pill draft">{count(coverage, "state", "assumed")} assumed</span>{" "}
                <span className="pill">{count(coverage, "state", "open")} open</span>
              </>
            )}
          </p>
        </section>
      )}

      <section>
        <h5>Source traceability</h5>
        {!trace ? (
          <p className="muted small">Checked once the FS is written.</p>
        ) : trace.applicable ? (
          <>
            <p className="small">
              <span className={`pill ${trace.unsourced.length ? "bad" : "good"}`}>{trace.sourced} of {trace.total} sourced</span> requirements, rules and validations name the RG or a client answer.
            </p>
            {trace.unsourced.length > 0 && <p className="warn small">No source: {trace.unsourced.join(", ")}. Review them before approval.</p>}
            {trace.assumedRows.length > 0 && <p className="muted small">From assumptions, for review: {trace.assumedRows.join(", ")}.</p>}
            {trace.notSpecified > 0 && <p className="muted small">{trace.notSpecified} {trace.notSpecified === 1 ? "place says" : "places say"} "Not specified in the RG": open, not filled in.</p>}
          </>
        ) : (
          <p className="muted small">This FS version was written before its requirements carried a Source column. Regenerate it to trace each requirement to the requirement text, an answer or an assumption.</p>
        )}
        {trace && trace.assumptions.length > 0 && (
          <p className="muted small">For review: {trace.assumptions.length} {trace.assumptions.length === 1 ? "assumption" : "assumptions"} ({trace.assumptions.join(", ")}). These are defaults, not confirmed client requirements.</p>
        )}
      </section>

      <Guardrails guard={state.guard} />

      <section>
        <h5>Validation</h5>
        <p className={`small ${gaps.length || (trace?.applicable && trace.unsourced.length) ? "warn" : ""}`}>{blocker}</p>
      </section>
    </div>
  );
}

/** What the guardrails caught for this requirement, and the checks of the current FS. */
function Guardrails({ guard }: { guard: any }) {
  if (!guard) return null;
  const events: any[] = guard.events ?? [];
  const injections = events.filter((e) => e.action === "guardrail.injection_suspected");
  const outOfScope = events.filter((e) => e.action === "guardrail.out_of_scope");
  const blocked = events.filter((e) => e.action === "guardrail.output_blocked");
  const unchecked = events.filter((e) => e.action === "guardrail.fsd_check_failed");
  const c = guard.fsChecks;
  const issues = c ? c.offCategory.length + c.missingSections.length + c.unlinkedCriteria + c.unsupportedClaims.length + (c.assumptionsMissing ? 1 : 0) : 0;
  return (
    <section>
      <h5>Guardrails</h5>
      {injections.length > 0 && (
        <div className="warn small">
          <b>Instruction-like text in client data</b>, treated as data and not followed:
          <ul className="gaps">{injections.map((e, i) => <li key={i}>{e.details.kind}: "{e.details.excerpt}"</li>)}</ul>
        </div>
      )}
      {outOfScope.length > 0 && (
        <p className="small">{outOfScope.length} out-of-scope {outOfScope.length === 1 ? "request was" : "requests were"} declined{outOfScope[0].details.topic ? ` (last: ${outOfScope[0].details.topic})` : ""}.</p>
      )}
      {unchecked.length > 0 && (
        <p className="warn small">FS checks could not run for {unchecked.map((e) => `v${e.details.version}`).join(", ")}: treat {unchecked.length === 1 ? "that version" : "those versions"} as unverified.</p>
      )}
      {blocked.length > 0 && <p className="warn small">{blocked.length} AI {blocked.length === 1 ? "response was" : "responses were"} blocked for repeating internal instructions.</p>}
      {c && (
        <>
          {c.missingSections.length > 0 && <p className="warn small">Required sections missing: {c.missingSections.join(", ")}. Add them with Modify FS or regenerate.</p>}
          {c.unlinkedCriteria > 0 && <p className="warn small">{c.unlinkedCriteria} acceptance {c.unlinkedCriteria === 1 ? "criterion names" : "criteria name"} no requirement, rule or validation ID.</p>}
          {c.offCategory.length > 0 && <p className="warn small">FS sections from another category: {c.offCategory.join(", ")}. Review or remove them with Modify FS.</p>}
          {c.unsupportedClaims.length > 0 && (
            <p className="warn small">Technical names not found in the RG, the answers or the summary: {c.unsupportedClaims.join(", ")}. Verify them before approval.</p>
          )}
          {c.assumptionsMissing && <p className="warn small">The FS has no assumptions section, so decisions made without the client are not visible as such.</p>}
          {issues === 0 && <p className="muted small">The current FS has its required sections, stays in its category, links its acceptance criteria, names no unverified technical objects and lists its assumptions.</p>}
        </>
      )}
      {!c && !injections.length && !outOfScope.length && !blocked.length && !unchecked.length && <p className="muted small">Nothing flagged.</p>}
    </section>
  );
}
