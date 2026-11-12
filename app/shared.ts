import { useEffect, useState } from "react";
import { Marked } from "marked";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type State = any;

export type StepProps = {
  state: State;
  busy: boolean;
  /** Resolves to whether the action succeeded; errors are shown by the page. */
  run: (action: string, label: string, payload?: Record<string, unknown>) => Promise<boolean>;
  go: (step: number) => void;
  /** Whether the TS and the steps built on it (ABAP code, workflow deliverables) are shown; see useTechnicalSteps. */
  technical?: boolean;
};

/**
 * The workspace shows RG to FS review and versions. The TS, and the ABAP code and workflow deliverables
 * that are built from it, stay fully implemented but are only shown when switched on:
 * NEXT_PUBLIC_SHOW_TECHNICAL_STEPS=1 in the environment, or ?technical=1 in the address (remembered in
 * this browser; ?technical=0 hides them again).
 */
export function useTechnicalSteps(): boolean {
  const [on, setOn] = useState(process.env.NEXT_PUBLIC_SHOW_TECHNICAL_STEPS === "1");
  useEffect(() => {
    try {
      const asked = new URLSearchParams(window.location.search).get("technical");
      if (asked === "1" || asked === "0") localStorage.setItem("supernova:technical", asked);
      const saved = localStorage.getItem("supernova:technical");
      if (saved) setOn(saved === "1");
    } catch {}
  }, []);
  return on;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const markdown = new Marked({ renderer: { html: (token: { text: string }) => escapeHtml(token.text) } });

export const renderMarkdown = (text: string) => markdown.parse(text) as string;
export const fmt = (iso: string) => new Date(iso).toLocaleString();
export const statusLabel = (status: string) => ({ DRAFT: "Draft", APPROVED: "Approved", SUPERSEDED: "Superseded" })[status] ?? status;
/** Only approved versions can be downloaded: the current approved one, or one approved before it was replaced. */
export const approvedVersion = (state: State, v: { id: number; status: string } | null | undefined) =>
  !!v && (v.status === "APPROVED" || (state?.approvals ?? []).some((a: any) => a.fsd_version_id === v.id && a.decision === "APPROVED"));
export const docxLink = (versionId: number) => `/api/download?fsd=${versionId}&format=docx`;
export const pdfLink = (versionId: number) => `/api/download?fsd=${versionId}&format=pdf`;

/**
 * Like fetch().json(), for the app's own API. While next dev recompiles a route it can answer once with an
 * HTML 404 page. The route never ran, so asking again is safe. Any other non-JSON answer is a real failure.
 */
export async function fetchJson(url: string, init?: RequestInit) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (res.headers.get("content-type")?.includes("application/json")) return res.json();
    if (res.status !== 404 || attempt >= 4) throw new Error(`The server did not answer properly (HTTP ${res.status}). Reload the page and try again.`);
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
  }
}
