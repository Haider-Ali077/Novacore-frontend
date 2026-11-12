"use client";

// RG intake for every WRICEF type (attachments with their extraction status, pasted text), what the
// RG Analyst read, the requirement tracker and the client's confirmation before an RG type's FS is
// written. The rest of the flow reuses the shared screens (chat, FS versions, approval, downloads).
import { useState, type Dispatch, type SetStateAction } from "react";
import { rgSubjects, rgUnrelated, wricefLabel } from "@/lib/wricef";
import { needsScopeConfirmation } from "@/lib/validation";
import { fetchJson, fmt, type StepProps } from "./shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type RgFile = {
  key: string; name: string; type: string; size: number; data: string;
  status: "reading" | "checking" | "ok" | "error"; characters?: number; error?: string;
};
export type RgDraft = { files: RgFile[]; text: string };
export const emptyRg = (): RgDraft => ({ files: [], text: "" });

const MAX_BYTES = 10 * 1024 * 1024;
export const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Every attachment read without error; an RG type also needs at least one attachment or pasted text. */
export const rgReady = (rg: RgDraft, needsRg: boolean) =>
  rg.files.every((f) => f.status === "ok") && (!needsRg || rg.files.length > 0 || rg.text.trim().length >= 40);
export const rgPayload = (rg: RgDraft) => ({ rgs: rg.files.map((f) => ({ filename: f.name, contentType: f.type, data: f.data })), rgText: rg.text });

/**
 * The client's RG: any number of attachments, each read on the server as soon as it is added so its
 * status shows next to it, and (for the RG types) pasted text. Files are not kept in browser storage.
 */
export function RgPicker({ value, setValue, disabled, withText, required }: {
  value: RgDraft; setValue: Dispatch<SetStateAction<RgDraft>>; disabled: boolean; withText: boolean; required: boolean;
}) {
  const update = (key: string, patch: Partial<RgFile>) => setValue((v) => ({ ...v, files: v.files.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
  const add = (list: FileList | null) => {
    for (const file of Array.from(list ?? [])) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const entry: RgFile = { key, name: file.name, type: file.type, size: file.size, data: "", status: "reading" };
      if (file.size > MAX_BYTES) Object.assign(entry, { status: "error", error: "Larger than 10 MB." });
      else if (/\.doc$/i.test(file.name)) Object.assign(entry, { status: "error", error: "Old .doc files cannot be read. Save it as .docx or PDF, or paste its text." });
      setValue((v) => ({ ...v, files: [...v.files, entry] }));
      if (entry.status === "error") continue;
      const reader = new FileReader();
      reader.onload = async () => {
        const data = String(reader.result).split(",")[1] ?? "";
        update(key, { data, status: "checking" });
        try {
          const res = await fetchJson("/api/pipeline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "previewRg", rgs: [{ filename: file.name, contentType: file.type, data }] }),
          });
          const r = res.results?.[0];
          update(key, r?.ok ? { status: "ok", characters: r.characters } : { status: "error", error: r?.error ?? "Could not be read." });
        } catch (e) {
          update(key, { status: "error", error: (e as Error).message });
        }
      };
      reader.onerror = () => update(key, { status: "error", error: "The file could not be read." });
      reader.readAsDataURL(file);
    }
  };
  const label = { reading: "Reading…", checking: "Extracting text…", ok: "", error: "" };
  return (
    <div className="rg-picker">
      <label className="field-label" htmlFor="rg-file">{required ? "RG documents (Requirement Gathering)" : "Attachments (optional)"}</label>
      <p className="muted small">
        {required
          ? "The RG Analyst reads all attachments together first, extracts the requirements, and then asks only about what they leave missing, unclear or contradictory."
          : "Add the client's RG or any supporting documents. They are read together with your description."}
      </p>
      <input id="rg-file" type="file" multiple accept=".docx,.pdf,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain,text/markdown"
        onChange={(e) => { add(e.target.files); e.target.value = ""; }} disabled={disabled} />
      <p className="muted small">Word (.docx), PDF, text or Markdown, up to 10 MB each. A scanned PDF has no text to read.</p>
      {value.files.length > 0 && (
        <ul className="attachments">
          {value.files.map((f) => (
            <li key={f.key} className={f.status}>
              <span className="att-name">{f.name}</span>
              <span className="muted small">{size(f.size)}</span>
              {f.status === "ok" && <span className="pill good">{f.characters?.toLocaleString()} characters</span>}
              {(f.status === "reading" || f.status === "checking") && <span className="pill">{label[f.status]}</span>}
              {f.status === "error" && <span className="pill bad">Not readable</span>}
              <button type="button" className="secondary small-btn" onClick={() => setValue((v) => ({ ...v, files: v.files.filter((x) => x.key !== f.key) }))} disabled={disabled}>Remove</button>
              {f.error && <div className="warn small">{f.error}</div>}
            </li>
          ))}
        </ul>
      )}
      {withText && (
        <>
          <label className="field-label" htmlFor="rg-text">{value.files.length ? "Additional RG text (optional)" : "Or paste the RG text"}</label>
          <textarea id="rg-text" rows={6} value={value.text} onChange={(e) => setValue((v) => ({ ...v, text: e.target.value }))} disabled={disabled}
            placeholder="Paste the requirement gathering document as the client wrote it." />
        </>
      )}
    </div>
  );
}

/** The attachments a requirement was created with. */
export function AttachmentList({ attachments }: { attachments: any[] }) {
  if (!attachments?.length) return null;
  return (
    <ul className="attachments compact">
      {attachments.map((a) => (
        <li key={a.id} className="ok"><span className="att-name">{a.filename}</span><span className="muted small">{size(a.size)} · {fmt(a.created_at)}</span></li>
      ))}
    </ul>
  );
}

/** What the RG Analyst read from the RG. Shown at the top of a Form's chat. */
export function RgCard({ rg, wricef }: { rg: any; wricef: string }) {
  if (!rg) return null;
  const a = rg.analysis;
  const mandatory = a?.gaps?.filter((g: any) => g.mandatory) ?? [];
  const subjects = rgSubjects(a);
  const unrelated = rgUnrelated(a);
  return (
    <div className="rg-card">
      <div className="row tight between">
        <b>RG{rg.documents > 1 ? ` (${rg.documents} documents)` : `: ${rg.filename}`}</b>
        <span className="muted small">{size(rg.size)} · {rg.characters.toLocaleString()} characters · uploaded {fmt(rg.created_at)}</span>
      </div>
      {!a ? (
        <p className="muted small">Not analyzed yet. Retry the interviewer to let the RG Analyst read it.</p>
      ) : (
        <>
          <p>{a.document_summary}</p>
          {subjects.length > 0 && (
            <ul className="rg-forms">
              {subjects.map((f, i) => (
                <li key={i}><b>{f.name}</b>{f.details.filter(Boolean).map((d) => ` · ${d}`).join("")}<span className="muted small"> ({f.rg_reference})</span></li>
              ))}
            </ul>
          )}
          <p className="small">
            <span className="pill">{a.requirements.length} requirements extracted</span>{" "}
            <span className={`pill ${a.gaps.length ? "draft" : "good"}`}>{a.gaps.length} gaps</span>{" "}
            {mandatory.length > 0 && <span className="pill bad">{mandatory.length} mandatory</span>}
          </p>
          <details>
            <summary>Requirements found in the RG</summary>
            <table className="small">
              <thead><tr><th>ID</th><th>Area</th><th>Requirement</th><th>RG reference</th></tr></thead>
              <tbody>{a.requirements.map((q: any) => <tr key={q.id}><td>{q.id}</td><td>{q.area}</td><td>{q.text}</td><td className="muted">{q.rg_reference}</td></tr>)}</tbody>
            </table>
          </details>
          {a.gaps.length > 0 && (
            <details>
              <summary>Missing, unclear or conflicting in the RG</summary>
              <table className="small">
                <thead><tr><th>ID</th><th>Area</th><th>Kind</th><th>Gap</th></tr></thead>
                <tbody>{a.gaps.map((g: any) => <tr key={g.id}><td>{g.id}</td><td>{g.area}</td><td>{g.kind}{g.mandatory && <span className="pill bad">mandatory</span>}</td><td>{g.description}</td></tr>)}</tbody>
              </table>
            </details>
          )}
          {unrelated.length > 0 && (
            <p className="muted small">Not part of this {wricefLabel(wricef).toLowerCase()} requirement (another WRICEF type): {unrelated.join(" · ")}</p>
          )}
        </>
      )}
      <details>
        <summary>RG text{rg.truncated ? " (first 20,000 characters)" : ""}</summary>
        <pre className="rg-text">{rg.preview}</pre>
      </details>
    </div>
  );
}

/** Which requirements are confirmed, still open or in conflict, as the interviewer last reported. */
export function RequirementTracker({ tracked, missing }: { tracked: any[]; missing: string[] }) {
  if (!tracked?.length && !missing?.length) return null;
  const by = (s: string) => tracked.filter((t) => t.status === s);
  const groups: [string, string, any[]][] = [["conflict", "In conflict", by("conflict")], ["open", "Open", by("open")], ["confirmed", "Confirmed", by("confirmed")]];
  return (
    <div className="tracker">
      <p className="small">
        {groups.map(([k, label, items]) => <span key={k} className={`pill ${k === "confirmed" ? "good" : k === "conflict" ? "bad" : "draft"}`}>{items.length} {label.toLowerCase()}</span>)}
      </p>
      {missing?.length > 0 && <p className="warn small"><b>Mandatory information still missing:</b> {missing.join("; ")}</p>}
      <details open={by("conflict").length > 0}>
        <summary>Requirement tracker</summary>
        {groups.filter(([, , items]) => items.length).map(([k, label, items]) => (
          <div key={k}>
            <h4>{label}</h4>
            <ul className="tracked">
              {items.map((t: any) => (
                <li key={t.id}><b>{t.id}</b> <span className="muted small">{t.area} · {t.source === "RG" ? "from the RG" : "from an answer"}</span>{t.mandatory && <span className="pill bad">mandatory</span>}<div>{t.text}</div></li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </div>
  );
}

/**
 * The client reviews the requirement and confirms it before any FS is written. While a mandatory item
 * is missing the FS cannot be written: the missing information is added through the interview instead.
 */
export function RgConfirm({ state, busy, run, go, regenerate = false }: Pick<StepProps, "state" | "busy" | "run" | "go"> & { regenerate?: boolean }) {
  const r = state.requirement;
  const label = wricefLabel(r.wricef);
  const example = r.wricef === "C"
    ? "For example: the source is the legacy ERP customer table exported as CSV; only active customers in company code 1000 are migrated; totals per company code must match."
    : r.wricef === "I"
    ? "For example: outbound from SAP to the CRM as a REST call when a customer is changed; failures are retried 3 times and then e-mailed to the integration team."
    : r.wricef === "E"
    ? "For example: the check runs when the sales order is saved, only for order type ZOR, and stops the order with an error."
    : "For example: the form is an Adobe Form, printed when the billing document is saved, in English and German.";
  const s = r.summary ?? {};
  const missing: string[] = s.mandatory_missing ?? [];
  const [checked, setChecked] = useState(false);
  const [scopeOk, setScopeOk] = useState(false);
  const [extra, setExtra] = useState("");
  const scopeConflict = needsScopeConfirmation(r);
  const revision = state.revisions?.[0]?.revision;
  const list = (items?: string[]) => (items?.length ? <ul>{items.map((f) => <li key={f}>{f}</li>)}</ul> : <p className="muted small">None.</p>);
  return (
    <div className="card">
      <h2>{regenerate ? "Confirm the revised requirements" : "Confirm the requirements"}</h2>
      <p className="muted">
        Review what was taken from the RG and from your answers{revision ? ` (requirement revision ${revision})` : ""}.
        {regenerate ? " Confirming writes a new major FS version; earlier versions, including approved ones, stay unchanged." : " The FS is written only from what you confirm, and becomes version 1.0."}
      </p>
      {r.interview?.contradictions?.length > 0 && <div className="notice"><span><b>Still contradictory:</b> {r.interview.contradictions.join(" ")}</span></div>}
      <RequirementTracker tracked={r.interview?.tracked ?? []} missing={[]} />
      <div className="confirm-grid">
        <div><h4>Stated in the RG or by you</h4>{list(s.business_facts)}</div>
        <div>
          <h4>Defaults you accepted</h4>{list(s.assumptions)}
          <h4>Still open (goes to Open questions)</h4>{list(s.open_questions)}
        </div>
      </div>
      {missing.length > 0 ? (
        <div className="notice block">
          <p><b>Mandatory information is missing:</b> {missing.join("; ")}. The FS cannot be written without it, and SuperNova will not invent it.</p>
          <label className="field-label" htmlFor="form-missing">Add the missing information</label>
          <textarea id="form-missing" rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={example} />
          <div className="row">
            <button onClick={async () => { await run("reviseAnswer", "Interviewer agent is updating the requirements", { text: extra }); setExtra(""); }} disabled={busy || !extra.trim()}>Add and re-check</button>
            <button className="secondary" onClick={() => go(0)} disabled={busy}>Open the chat</button>
          </div>
        </div>
      ) : (
        <>
          <label className="confirm-check">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={busy} /> I have reviewed these requirements and confirm they are complete and correct.
          </label>
          {scopeConflict && <ScopeConfirm r={r} checked={scopeOk} onChange={setScopeOk} disabled={busy} />}
          <div className="row">
            <button onClick={() => run("generateFsd", `FS Generator agent is writing the ${label} FS`, { confirmed: true, scopeConfirmed: scopeOk })} disabled={busy || !checked || (scopeConflict && !scopeOk)}>
              {regenerate ? "Confirm and regenerate the FS" : "Confirm and write the FS"}
            </button>
            <button className="secondary" onClick={() => go(0)} disabled={busy}>Revise requirements</button>
          </div>
        </>
      )}
    </div>
  );
}

/** The AI read the requirement as another category: the user confirms the selected one before the FS is written. */
export function ScopeConfirm({ r, checked, onChange, disabled }: { r: any; checked: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  const c = r.classification;
  return (
    <div className="notice block small">
      {c?.error ? (
        <p>The AI classification failed ({c.error}), so the category could not be checked. Confirm it, or use "Classify again" in AI insights.</p>
      ) : (
        <p>
          The AI classified this requirement as <b>{wricefLabel(c.suggested)}</b> ({Math.round(c.confidence * 100)}% confidence), but it is a{" "}
          <b>{wricefLabel(r.wricef)}</b> requirement. The FS stays within {wricefLabel(r.wricef)}; anything from another category is listed as out of scope, not specified.
        </p>
      )}
      <label className="confirm-check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} /> This is a {wricefLabel(r.wricef)} requirement. Write the FS for {wricefLabel(r.wricef)}.
      </label>
    </div>
  );
}

/**
 * The RG or requirement does not belong to the selected category. Everything else in the requirement is
 * closed (the server refuses it too); the AI's result is shown, and the requirement can be started again
 * in the category it belongs to, with the same RG and client.
 */
export function CategoryBlocked({ block, r, busy, run }: { block: any; r: any; busy: boolean; run: StepProps["run"] }) {
  const pct = typeof block.confidence === "number" ? Math.round(block.confidence * 100) : null;
  const offered = block.suggested && ["R", "W", "I", "C", "E", "F"].includes(block.suggested) ? block.suggested : null;
  return (
    <div className="card blocked-card" role="alert">
      <h2>Not a {wricefLabel(r.wricef)} requirement</h2>
      <p className="warn">{block.message}</p>
      <div className="blocked-result">
        <span className="muted small">AI classification</span>
        <p className="classification-line">
          <b>{offered ? wricefLabel(offered) : block.reason === "no_category" ? "No supported category" : "Not determined"}</b>
          {pct !== null && <span className={`pill ${pct >= 75 ? "good" : pct >= 50 ? "draft" : "bad"}`}>{pct}% confidence</span>}
        </p>
        {block.explanation && <p className="muted small">{block.explanation}</p>}
      </div>
      <p className="muted small">
        No answers, revisions or FS can be sent in this requirement.
        {offered ? ` Create it as a ${wricefLabel(offered)}: the RG documents, client and project are carried over, and this requirement is kept as it is.` : " Start a new requirement in the category it belongs to."}
      </p>
      <div className="row">
        {offered && (
          <button onClick={() => run("startAs", `Starting the requirement as ${wricefLabel(offered)}`, { wricef: offered })} disabled={busy}>
            Create as {wricefLabel(offered)}
          </button>
        )}
        <button className="secondary" onClick={() => run("classify", "Classifier agent is reading the requirement")} disabled={busy}>Classify again</button>
      </div>
    </div>
  );
}
