"use client";

// AI usage: token consumption and estimated cost across all requirements, on its own page so the
// workspace's home screen only shows how to start a requirement.
import { useEffect, useState } from "react";
import { AppNav, Brand } from "../nav";
import { fetchJson } from "../shared";
import { UsageDashboard } from "../usage-panels";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function UsagePage() {
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchJson("/api/state").then(setState).catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <Brand />
        <AppNav current="usage" />
        <span className="spacer" />
      </header>
      <main className="page-content">
        {!state ? (
          <div className="loading">{error ?? "Loading..."}</div>
        ) : (
          <UsageDashboard usage={state.usage} onOpen={(id) => (window.location.href = `/?id=${id}`)} />
        )}
      </main>
    </div>
  );
}
