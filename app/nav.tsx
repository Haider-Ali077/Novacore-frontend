"use client";

// The brand and the page links shared by every page's top bar.
import Link from "next/link";

export function Brand() {
  return (
    <div className="brand">
      <span className="logo" aria-hidden />
      <div>
        <b>SuperNova</b>
        <small>SAP FSD to ABAP workspace</small>
      </div>
    </div>
  );
}

const PAGES = [
  { id: "workspace", href: "/", label: "Workspace" },
  { id: "usage", href: "/usage", label: "AI usage" },
] as const;

export function AppNav({ current }: { current: (typeof PAGES)[number]["id"] }) {
  return (
    <nav className="app-nav" aria-label="Pages">
      {PAGES.map((p) => (
        <Link key={p.id} href={p.href} className={p.id === current ? "active" : ""} aria-current={p.id === current ? "page" : undefined}>
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
