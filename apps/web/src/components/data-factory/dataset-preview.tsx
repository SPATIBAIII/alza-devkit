import { useState } from "react";
import { Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportActions } from "./export-actions";
import type { HouseholdDataset } from "@/types/data-factory";

const PAGE_SIZE = 25;
const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export function DatasetPreview({ dataset, busy }: { dataset: HouseholdDataset | null; busy: boolean }) {
  const [page, setPage] = useState(1);
  const pages = dataset ? Math.ceil(dataset.data.length / PAGE_SIZE) : 1;
  const records = dataset?.data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? [];

  return (
    <section aria-busy={busy} className="min-w-0 overflow-hidden rounded-[28px] border border-white/80 bg-white/80 shadow-sm backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 sm:p-8">
        <div>
          <h3 className="text-lg font-semibold">Dataset preview</h3>
          <p className="mt-1 text-sm text-slate-500" role="status">
            {busy ? "Generating synthetic households…" : dataset ? `${dataset.total_records.toLocaleString()} synthetic records · Seed ${dataset.seed}` : "Your generated households will appear here."}
          </p>
        </div>
        {dataset && <ExportActions config={{ count: dataset.total_records, seed: dataset.seed }} disabled={busy} />}
      </div>
      {dataset ? (
        <>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Synthetic household records">
            <table className="w-full min-w-[850px] text-left text-sm">
              <caption className="sr-only">Synthetic household dataset. Income categories are illustrative testing values.</caption>
              <thead className="border-y border-slate-200/70 bg-slate-50/80 text-xs text-slate-500">
                <tr>{["Household ID", "Household Head", "Barangay", "Household Size", "Monthly Income", "Income Category"].map((label) => <th scope="col" key={label} className="whitespace-nowrap px-6 py-4 font-medium">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((row) => (
                  <tr key={row.household_id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4 font-mono text-xs">{row.household_id}</td>
                    <td className="px-6 py-4 font-medium">{row.household_head}</td>
                    <td className="px-6 py-4 text-slate-500">{row.barangay}</td>
                    <td className="px-6 py-4 tabular-nums">{row.household_size}</td>
                    <td className="whitespace-nowrap px-6 py-4 tabular-nums">{currency.format(row.monthly_income)}</td>
                    <td className="px-6 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{row.income_category}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 p-6 text-xs text-slate-500">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, dataset.total_records)} of {dataset.total_records}</span>
            <div className="flex items-center gap-3">
              <Button variant="outline" disabled={busy || page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span aria-live="polite">Page {page} of {pages}</span>
              <Button variant="outline" disabled={busy || page === pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      ) : (
        <div className="mx-6 mb-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center text-slate-500 sm:mx-8 sm:mb-8">
          <Database className="mx-auto mb-3 size-7 text-slate-400" />
          <p className="text-sm">{busy ? "Preparing your dataset…" : "Choose your settings and click Generate Dataset to get started."}</p>
        </div>
      )}
    </section>
  );
}
