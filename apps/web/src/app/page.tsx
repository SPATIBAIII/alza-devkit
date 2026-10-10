
"use client";

import { useState } from "react";
import { DataFactory } from "@/components/data-factory/data-factory";
import {
  Activity,
  ArrowRight,
  Bell,
  Braces,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Projects", icon: FolderKanban },
  { label: "Mock Data Factory", icon: FileSpreadsheet },
  { label: "Code Auditor", icon: ShieldCheck },
  { label: "API Testing Lab", icon: Braces },
  { label: "Database Inspector", icon: Database },
  { label: "Monitoring", icon: Activity },
];

const modules = [
  {
    name: "Mock Data Factory",
    description:
      "Generate realistic synthetic datasets for testing, analytics, and development.",
    icon: FileSpreadsheet,
    status: "Available",
    available: true,
  },
  {
    name: "Code Auditor",
    description:
      "Analyze code quality, detect vulnerabilities, and review dependencies.",
    icon: ShieldCheck,
    status: "Planned",
    available: false,
  },
  {
    name: "API Testing Lab",
    description:
      "Organize API requests, automate tests, and inspect responses.",
    icon: Braces,
    status: "Planned",
    available: false,
  },
  {
    name: "Database Inspector",
    description:
      "Explore schemas, relationships, and database structure.",
    icon: Database,
    status: "Planned",
    available: false,
  },
];

export default function Home() {
  const [activePage, setActivePage] = useState("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  function navigate(page: string) {
    setActivePage(page);
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa] text-slate-900">
      <div className="pointer-events-none fixed -top-32 left-1/3 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />

      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-30 rounded-xl border border-white bg-white/90 p-3 shadow-sm lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed bottom-4 left-4 top-4 z-50 flex w-64 flex-col rounded-[28px] border border-white/80 bg-white/80 p-4 shadow-xl shadow-slate-200/50 backdrop-blur-2xl transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-[120%]"
        }`}
      >
        <div className="mb-9 flex items-center justify-between px-2 pt-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Sparkles size={21} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">ALZA</h1>
              <p className="text-xs text-slate-500">Developer Toolkit</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden"
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>

        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Workspace
        </p>

        <nav className="flex-1 space-y-1">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => navigate(label)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                activePage === label
                  ? "bg-slate-900 font-medium text-white shadow-md"
                  : "text-slate-500 hover:bg-white hover:text-slate-900"
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-200/70 pt-3">
          <button
            onClick={() => navigate("Settings")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-white"
          >
            <Settings2 size={18} />
            Settings
          </button>
          <div className="mt-3 rounded-2xl bg-slate-100/80 p-3">
            <p className="text-sm font-semibold">Private Workspace</p>
            <p className="mt-1 text-xs text-slate-500">
              ALZA DevKit v0.1.0
            </p>
          </div>
        </div>
      </aside>

      <main className="relative min-h-screen px-5 pb-12 pt-20 sm:px-8 lg:ml-72 lg:px-10 lg:pt-9">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Developer Workspace
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {activePage}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:inline-flex">
              Local Development
            </span>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white bg-white/80 text-slate-500"
              aria-label="Notifications are not configured"
              title="Notifications are not configured"
            >
              <Bell size={18} />
            </div>
          </div>
        </header>

        {activePage === "Overview" ? (
          <div className="space-y-7">
            <section className="relative overflow-hidden rounded-[28px] bg-slate-900 p-7 text-white sm:p-10">
              <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
              <div className="relative max-w-xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs">
                  <Sparkles size={13} />
                  Developer Operations Platform
                </div>
                <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Build smarter.
                  <br />
                  Develop with clarity.
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  Your centralized workspace for development tools,
                  synthetic data, API testing, and project utilities.
                </p>
                <button
                  onClick={() => navigate("Mock Data Factory")}
                  className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Explore Data Factory <ArrowRight size={16} />
                </button>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Available Modules", value: "01", detail: "Ready to use" },
                { label: "Planned Modules", value: "03", detail: "Coming later" },
                { label: "Workspace", value: "Local", detail: "Private development" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl"
                >
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">{stat.detail}</p>
                </div>
              ))}
            </section>

            <section>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Developer Tools</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Modules in the ALZA ecosystem
                  </p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {modules.map(({ name, description, icon: Icon, status, available }) => (
                  <button
                    key={name}
                    disabled={!available}
                    onClick={() => navigate(name)}
                    className="group flex min-h-48 flex-col rounded-2xl border border-white/80 bg-white/75 p-6 text-left shadow-sm backdrop-blur-xl transition enabled:hover:-translate-y-1 enabled:hover:shadow-lg disabled:cursor-not-allowed"
                  >
                    <div className="mb-5 flex w-full items-center justify-between">
                      <div className="rounded-xl bg-slate-100 p-3">
                        <Icon size={21} className="text-slate-700" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-500">
                        {status}
                      </span>
                    </div>
                    <h4 className="text-base font-semibold">{name}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {description}
                    </p>
                    {available && (
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                        Open module <ChevronRight size={14} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : activePage === "Mock Data Factory" ? (
          <DataFactory />
        ) : (
          <section className="rounded-[28px] border border-white/80 bg-white/80 p-8 shadow-sm backdrop-blur-xl">
            <h3 className="text-xl font-semibold">{activePage}</h3>
            <p className="mt-3 text-sm text-slate-500">
              This section is planned for a future development phase.
            </p>
          </section>
        )}

        <footer className="mt-12 flex items-center justify-between border-t border-slate-200/70 pt-6 text-xs text-slate-400">
          <span>ALZA DevKit © 2026</span>
          <span>Version 0.1.0</span>
        </footer>
      </main>
    </div>
  );
}
