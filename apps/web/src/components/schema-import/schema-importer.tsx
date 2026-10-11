"use client";

import { useEffect, useState } from "react";
import { Database, KeyRound, Link2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customRequest, downloadResponse } from "@/lib/custom-dataset-api";
import { schemaRequest } from "@/lib/schema-import-api";
import { exampleSQL, tableKey, type DatabaseSchema, type SchemaDataset, type SchemaTable } from "@/types/schema-import";
import { MappingEditor } from "./mapping-editor";

const panel = "min-w-0 rounded-2xl border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur-xl sm:p-6";
const select = "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm";
const steps = ["Import", "Inspect", "Configure", "Generate", "Saved schemas"];

export function SchemaImporter() {
  const [step, setStep] = useState(0);
  const [sql, setSQL] = useState("");
  const [name, setName] = useState("Student enrollment");
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [dataset, setDataset] = useState<SchemaDataset | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [page, setPage] = useState(0);
  const [saved, setSaved] = useState<DatabaseSchema[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let current = true;
    customRequest("/custom/field-types").then(r => r.json()).then((values: string[]) => {
      if (current) setTypes(values.filter(v => v !== "computed"));
    }).catch(() => { if (current) setError("Could not load generator types. Check the API and reopen this module."); });
    return () => { current = false; };
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to complete this action."); }
    finally { setBusy(false); }
  }
  function edit(next: DatabaseSchema) { setSchema(next); setDataset(null); setMessage(""); }
  function editTable(next: SchemaTable) {
    if (schema) edit({ ...schema, tables: schema.tables.map((t, i) => i === active ? next : t) });
  }
  function open(next: DatabaseSchema) {
    setSchema(next); setName(next.name); setDataset(null); setActive(0); setPage(0); setStep(1);
  }
  async function refreshSaved() { setSaved(await (await schemaRequest("/schemas")).json()); }
  async function readFile(file: File, config: boolean) {
    if (file.size > (config ? 2_000_000 : 262144)) throw new Error(config ? "Configuration exceeds 2 MB." : "SQL exceeds 256 KB.");
    if (!file.name.toLowerCase().endsWith(config ? ".json" : ".sql")) throw new Error(config ? "Choose a .json file." : "Choose a .sql file.");
    const content = await file.text();
    if (config) {
      const next = await (await schemaRequest("/schemas/import", "POST", JSON.parse(content))).json();
      await refreshSaved(); open(next); setMessage("Schema configuration imported.");
    } else { setSQL(content); setMessage("SQL file loaded. Parse to inspect its tables."); }
  }
  const table = schema?.tables[active];
  const records = dataset?.tables[previewKey] ?? [];
  const relationshipCount = schema?.tables.reduce((n, t) => n + t.foreign_keys.length, 0) ?? 0;

  return <div className="space-y-5">
    <p className="max-w-3xl text-sm leading-6 text-slate-500">Turn PostgreSQL table definitions into related synthetic datasets. Import, inspect and generate entirely locally, without database credentials.</p>
    <fieldset disabled={busy} className="min-w-0 space-y-5 disabled:opacity-70">
      <nav aria-label="Schema import steps" className="flex flex-wrap gap-2">
        {steps.map((label, index) => <Button key={label} variant={step === index ? "default" : "outline"} aria-current={step === index ? "step" : undefined}
          disabled={index > 0 && index < 4 && !schema} onClick={() => { setStep(index); if (index === 4) void run(refreshSaved); }}>
          {index < 4 ? `${index + 1}. ` : ""}{label}
        </Button>)}
      </nav>
      {step === 0 && <section className={`${panel} space-y-4`}>
        <h3 className="text-lg font-semibold">Import PostgreSQL DDL</h3>
        <label className="block space-y-1 text-sm">Database name<Input value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label>
        <label className="block space-y-1 text-sm">SQL schema<textarea aria-label="SQL schema" spellCheck={false} className="h-80 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm" value={sql} onChange={e => setSQL(e.target.value)} placeholder="CREATE TABLE public.students (...)" /></label>
        <p className="text-xs text-slate-500">Up to 256 KB · 20 tables · 50 columns per table. Unsupported statements and constraints are rejected. Imported SQL is never executed.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!sql.trim()} onClick={() => void run(async () => { open(await (await schemaRequest("/parse", "POST", { sql, name })).json()); })}>Parse Schema</Button>
          <Button variant="outline" onClick={() => { setSQL(exampleSQL); setName("Student enrollment"); }}>Example Schema</Button>
          <label className="flex max-w-full flex-wrap items-center gap-2 text-sm"><Upload size={16} />Upload .sql<input aria-label="Upload SQL file" type="file" accept=".sql" className="max-w-full text-xs" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void run(() => readFile(file, false)); }} /></label>
        </div>
      </section>}
      {(step === 1 || step === 2) && schema && <>
        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="break-all text-lg font-semibold">{schema.name}</h3><span className="text-xs text-slate-500">PostgreSQL · configuration v{schema.version}</span></div>
          <div className="mt-4 flex flex-wrap gap-6 text-sm"><span>{schema.tables.length} tables</span><span>{schema.tables.reduce((n, t) => n + t.columns.length, 0)} columns</span><span>{relationshipCount} relationships</span></div>
          {schema.warnings.length > 0 && <details className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><summary className="cursor-pointer">Import notes ({schema.warnings.length})</summary><ul className="mt-2 list-disc space-y-1 pl-5">{schema.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
        </section>
        <div className="grid min-w-0 gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
          <section className={`${panel} space-y-2`} aria-label="Discovered tables"><h3 className="mb-3 font-semibold">Tables</h3>
            {schema.tables.map((t, i) => <button key={tableKey(t)} className={`flex w-full items-center gap-2 rounded-xl p-3 text-left text-sm ${active === i ? "bg-slate-900 text-white" : "bg-slate-50 hover:bg-slate-100"}`} aria-pressed={active === i} onClick={() => setActive(i)}><Database size={16} className="shrink-0" /><span className="break-all">{t.schema_name}.{t.name}</span></button>)}
          </section>
          {table && <section className={`${panel} space-y-4`}>
            <h3 className="break-all text-lg font-semibold">{table.schema_name}.{table.name}</h3>
            {step === 1 ? <>
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500">{["Column", "SQL type", "Nullable", "Keys"].map(h => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead><tbody>
                {table.columns.map(c => <tr key={c.name} className="border-b border-slate-100"><td className="p-2">{c.name}</td><td className="p-2">{c.database_type}{c.type_arguments.length ? `(${c.type_arguments.join(", ")})` : ""}</td><td className="p-2">{c.nullable ? "Yes" : "No"}</td><td className="p-2"><span className="flex items-center gap-2">{c.primary_key && <span title="Primary key" className="inline-flex items-center gap-1"><KeyRound size={13} />PK</span>}{table.foreign_keys.some(f => f.source_columns.includes(c.name)) && <span className="inline-flex items-center gap-1"><Link2 size={13} />FK</span>}{c.unique && "Unique"}</span></td></tr>)}
              </tbody></table></div>
              <div className="space-y-2 text-sm"><p><strong>Primary key:</strong> {table.primary_key.join(", ") || "None"}</p><p><strong>Unique groups:</strong> {table.unique_constraints.map(g => `(${g.join(", ")})`).join(" · ") || "None"}</p><p><strong>CHECK:</strong> {table.checks.map(c => `${c.column} ${c.operator} ${c.value}`).join("; ") || "None"}</p></div>
              <details className="text-sm"><summary className="cursor-pointer">Defaults and enum domains</summary>{table.columns.filter(c => c.default || c.enum_values.length).map(c => <p className="mt-2 break-all" key={c.name}>{c.name}: {c.default ? `DEFAULT ${c.default} (not evaluated)` : c.enum_values.join(", ")}</p>)}</details>
              <div className="space-y-2 border-t border-slate-200 pt-4"><h4 className="font-medium">Relationships</h4>{!table.foreign_keys.length && <p className="text-sm text-slate-500">No outgoing foreign keys.</p>}
                {table.foreign_keys.map((f, i) => <div key={i} className="rounded-xl bg-blue-50 p-3 text-sm"><p className="break-all">({f.source_columns.join(", ")}) → {f.target_table} ({f.target_columns.join(", ")})</p><p className="mt-1 text-xs text-slate-500">ON DELETE {f.on_delete} · ON UPDATE {f.on_update}</p><Button className="mt-2" size="sm" variant="outline" disabled={!schema.tables.some(t => tableKey(t) === f.target_table)} onClick={() => setActive(schema.tables.findIndex(t => tableKey(t) === f.target_table))}>Inspect parent table</Button></div>)}
              </div>
              <Button onClick={() => setStep(2)}>Configure generation</Button>
            </> : <>
              <div className="flex flex-wrap items-center gap-5"><label className="text-sm"><input type="checkbox" checked={table.selected} onChange={e => editTable({ ...table, selected: e.target.checked })} /> Include this table</label><label className="text-sm">Rows for {table.name}<Input type="number" min={0} max={1000} value={table.row_count} onChange={e => editTable({ ...table, row_count: Number(e.target.value) })} /></label></div>
              <p className="text-xs text-slate-500">Parent tables must also be selected. Up to 1,000 rows per table and 5,000 total. Imported constraints remain enforced; review mappings below.</p>
              {table.columns.map((c, i) => <MappingEditor key={c.name} column={c} types={types.length ? types : [c.synthetic_generator]} foreign={table.foreign_keys.some(f => f.source_columns.includes(c.name))}
                onChange={next => editTable({ ...table, columns: table.columns.map((value, j) => j === i ? next : value) })} />)}
            </>}
          </section>}
        </div>
        {step === 2 && <section className={`${panel} space-y-4`}>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Configuration name<Input value={schema.name} maxLength={100} onChange={e => edit({ ...schema, name: e.target.value })} /></label><label className="text-sm">Generation seed<Input type="number" min={0} max={9007199254740991} value={schema.seed} onChange={e => edit({ ...schema, seed: Number(e.target.value) })} /></label></div>
          <p className="text-sm text-slate-500">{schema.tables.filter(t => t.selected).reduce((n, t) => n + t.row_count, 0)} records selected</p>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void run(async () => { const result = await (await schemaRequest("/validate", "POST", schema)).json(); setMessage(`${result.message} Order: ${result.order.join(" → ")}`); })}>Validate Schema</Button>
            <Button variant="outline" onClick={() => void run(async () => { setSchema(await (await schemaRequest(schema.id ? `/schemas/${schema.id}` : "/schemas", schema.id ? "PUT" : "POST", schema)).json()); setMessage("Schema configuration saved."); })}>Save Configuration</Button>
            <Button onClick={() => setStep(3)}>Continue to generate</Button></div>
        </section>}
      </>}
      {step === 3 && schema && <section className={`${panel} space-y-5`}>
        <h3 className="text-lg font-semibold">Generate related tables</h3><p className="text-sm text-slate-500">{schema.name} · Seed {schema.seed}. Parents are generated before children; foreign keys are copied as complete tuples.</p>
        <Button onClick={() => void run(async () => { const next: SchemaDataset = await (await schemaRequest("/generate", "POST", schema)).json(); setDataset(next); setPreviewKey(next.order[0]); setPage(0); setMessage("Dataset generated."); })}>Generate Dataset</Button>
        {dataset && <>
          <p className="text-sm">{dataset.total_records} synthetic records · Seed {dataset.seed}</p>
          <label className="block text-sm">Preview table<select className={`${select} mt-1`} value={previewKey} onChange={e => { setPreviewKey(e.target.value); setPage(0); }}>{dataset.order.map(key => <option key={key} value={key}>{key} ({dataset.tables[key].length} rows)</option>)}</select></label>
          <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-50"><tr>{dataset.fields[previewKey]?.map(c => <th className="p-3 font-medium" key={c}>{c}</th>)}</tr></thead><tbody>{records.slice(page * 25, (page + 1) * 25).map((row, i) => <tr className="border-t border-slate-100" key={i}>{dataset.fields[previewKey].map(c => <td className="max-w-72 truncate p-3" key={c} title={String(row[c] ?? "NULL")}>{String(row[c] ?? "NULL")}</td>)}</tr>)}</tbody></table></div>
          <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm">Page {page + 1} of {Math.max(1, Math.ceil(records.length / 25))}</span><Button variant="outline" disabled={(page + 1) * 25 >= records.length} onClick={() => setPage(page + 1)}>Next</Button></div>
          <div className="flex flex-wrap gap-2">{[["JSON", "json"], ["CSV ZIP", "csv"], ["Excel", "xlsx"]].map(([label, format]) => <Button key={format} variant="outline" onClick={() => void run(async () => { await downloadResponse(await schemaRequest(`/export?format=${format}`, "POST", schema), `synthetic-schema.${format === "csv" ? "zip" : format}`); })}>Download {label}</Button>)}</div>
        </>}
      </section>}
      {step === 4 && <section className={`${panel} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Saved schema configurations</h3><Button variant="outline" onClick={() => void run(refreshSaved)}>Refresh</Button></div>
        <label className="block text-sm">Import configuration JSON<input aria-label="Import configuration JSON" type="file" accept=".json" className="mt-2 block max-w-full text-xs" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void run(() => readFile(file, true)); }} /></label>
        {!saved.length && <p className="py-4 text-sm text-slate-500">No saved schemas. Save a configuration from the Configure step.</p>}
        {saved.map(item => <article className="space-y-3 rounded-xl border border-slate-200 p-4" key={item.id}>
          <label className="block text-sm">Saved schema name<Input aria-label={`Rename ${item.id}`} value={item.name} maxLength={100} onChange={e => setSaved(saved.map(s => s.id === item.id ? { ...s, name: e.target.value } : s))} /></label>
          <p className="text-xs text-slate-500">{item.tables.length} tables · Seed {item.seed}</p>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void run(async () => { open(await (await schemaRequest(`/schemas/${item.id}`)).json()); })}>Open</Button>
            <Button variant="outline" onClick={() => void run(async () => { await schemaRequest(`/schemas/${item.id}`, "PUT", item); await refreshSaved(); setMessage("Schema renamed."); })}>Rename</Button>
            <Button variant="outline" onClick={() => void run(async () => { await downloadResponse(await schemaRequest(`/schemas/${item.id}/export`), `schema-${item.id}.json`); })}>Export configuration JSON</Button>
            <Button variant="outline" onClick={() => void run(async () => { await schemaRequest(`/schemas/${item.id}`, "DELETE"); if (schema?.id === item.id) setSchema({ ...schema, id: null }); await refreshSaved(); setMessage("Schema deleted."); })}>Delete</Button></div>
        </article>)}
      </section>}
    </fieldset>
    {busy && <p role="status" className="text-sm text-slate-500">Processing schema…</p>}
    {error && <p role="alert" className="break-words rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="break-words rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
  </div>;
}
