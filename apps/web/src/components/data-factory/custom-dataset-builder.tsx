"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customRequest, downloadResponse } from "@/lib/custom-dataset-api";
import { newField, presets, type CustomDataset, type CustomRequest, type Template } from "@/types/custom-dataset";
import { CustomFieldEditor } from "./custom-field-editor";

const card = "rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:p-8";
const select = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm";
function definition(template: Template): Template {
  const copy = { ...template }; delete copy.id; return copy;
}

export function CustomDatasetBuilder() {
  const [template, setTemplate] = useState<Template>(() => structuredClone(presets[0]));
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [count, setCount] = useState(100);
  const [seed, setSeed] = useState(42);
  const [dataset, setDataset] = useState<CustomDataset | null>(null);
  const [snapshot, setSnapshot] = useState<CustomRequest | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const request: CustomRequest = { template: definition(template), count, seed };
  const stale = snapshot !== null && JSON.stringify(snapshot) !== JSON.stringify(request);

  useEffect(() => {
    let active = true;
    Promise.all([customRequest("/templates").then(r => r.json()), customRequest("/custom/field-types").then(r => r.json())])
      .then(([saved, fieldTypes]) => { if (active) {
        setTemplates(saved); setTypes(fieldTypes);
        try {
          const ids: unknown = JSON.parse(localStorage.getItem("data-factory-recent") ?? "[]");
          if (Array.isArray(ids)) setRecent(ids.filter((id): id is string => typeof id === "string").slice(0, 5));
        } catch { /* Optional recent IDs only. */ }
      } })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Request failed."); }
    finally { locked.current = false; setBusy(false); }
  }
  async function refresh() { setTemplates(await (await customRequest("/templates")).json()); }
  function load(t: Template) {
    setTemplate(structuredClone(t)); setMessage(""); setError("");
    if (t.id) {
      const ids = [t.id, ...recent.filter(id => id !== t.id)].slice(0, 5); setRecent(ids);
      try { localStorage.setItem("data-factory-recent", JSON.stringify(ids)); } catch { /* Storage may be disabled. */ }
    }
  }
  function nextName(base: string) {
    let i = 1; while (template.fields.some(f => f.name === `${base.slice(0, 55)}_${i}`)) i++;
    return `${base.slice(0, 55)}_${i}`;
  }

  return <div className="space-y-6" aria-busy={busy}>
    <fieldset disabled={busy} className="min-w-0 space-y-6">
      <section className={card}>
        <h3 className="text-lg font-semibold">Custom Dataset</h3>
        <p className="mt-1 text-sm text-slate-500">Build synthetic records with reusable fields and templates.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Dataset name<Input value={template.name} maxLength={100} onChange={e => setTemplate({ ...template, name: e.target.value })} /></label>
          <label className="space-y-1 text-sm">Description<Input value={template.description} maxLength={1000} onChange={e => setTemplate({ ...template, description: e.target.value })} /></label>
        </div>
        <details className="mt-5" open><summary className="cursor-pointer font-medium">Template library</summary>
          <label className="mt-3 block space-y-1 text-sm">Load template<select aria-label="Load template" className={select} value="" onChange={e => {
            const value = e.target.value;
            if (value.startsWith("preset:")) load(presets[Number(value.split(":")[1])]);
            else void run(async () => load(await (await customRequest(`/templates/${value}`)).json()));
          }}><option value="" disabled>Select a preset or saved template</option>
            <optgroup label="Built-in presets">{presets.map((t, i) => <option key={t.name} value={`preset:${i}`}>{t.name}</option>)}</optgroup>
            <optgroup label="Recently used">{recent.map(id => templates.find(t => t.id === id)).filter((t): t is Template => !!t).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
            <optgroup label="Saved templates">{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
          </select></label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void run(async () => {
              const saved = await (await customRequest(template.id ? `/templates/${template.id}` : "/templates", template.id ? "PUT" : "POST", definition(template))).json();
              load(saved); await refresh(); setMessage("Template saved.");
            })}>Save Template</Button>
            <Button variant="outline" disabled={!template.id} onClick={() => void run(async () => {
              load(await (await customRequest(`/templates/${template.id}/duplicate`, "POST")).json()); await refresh(); setMessage("Saved template duplicated.");
            })}>Duplicate Template</Button>
            <Button variant="outline" disabled={!template.id} onClick={() => void run(async () => {
              await customRequest(`/templates/${template.id}`, "DELETE"); setTemplate(definition(template)); await refresh(); setMessage("Template deleted.");
            })}>Delete Template</Button>
            <Button variant="outline" disabled={!template.id} onClick={() => void run(async () => downloadResponse(await customRequest(`/templates/${template.id}/export`), "dataset-template.json"))}>Export Template JSON</Button>
          </div>
          <label className="mt-4 block text-sm">Import template JSON (up to 256 KB)<input className="mt-2 block w-full text-sm" type="file" accept=".json,application/json" onChange={e => {
            const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
            void run(async () => {
              if (file.size > 262144) throw new Error("Template exceeds 256 KB.");
              load(await (await customRequest("/templates/import", "POST", JSON.parse(await file.text()))).json()); await refresh(); setMessage("Template imported.");
            });
          }} /></label>
        </details>
      </section>
      <section className={card}>
        <h3 className="text-lg font-semibold">Fields <span className="text-sm font-normal text-slate-500">{template.fields.length} / 50</span></h3>
        <div className="mt-4 space-y-3">{template.fields.map((field, i) => <CustomFieldEditor key={i} field={field} index={i} count={template.fields.length} types={types.length ? types : [field.type]}
          onChange={value => setTemplate({ ...template, fields: template.fields.map((f, j) => j === i ? value : f) })}
          onDelete={() => setTemplate({ ...template, fields: template.fields.filter((_, j) => j !== i) })}
          onDuplicate={() => { const fields = [...template.fields]; fields.splice(i + 1, 0, { ...structuredClone(field), name: nextName(field.name) }); setTemplate({ ...template, fields }); }}
          onMove={direction => { const fields = [...template.fields]; [fields[i], fields[i + direction]] = [fields[i + direction], fields[i]]; setTemplate({ ...template, fields }); }}
        />)}</div>
        <Button className="mt-4" variant="outline" disabled={template.fields.length >= 50} onClick={() => setTemplate({ ...template, fields: [...template.fields, newField(nextName("field"))] })}><Plus />Add field</Button>
      </section>
      <section className={card}>
        <h3 className="text-lg font-semibold">Generation settings</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm">Record count<Input type="number" min={1} max={1000} value={count} onChange={e => setCount(Number(e.target.value))} /></label>
          <label className="space-y-1 text-sm">Random seed<Input type="number" min={0} max={Number.MAX_SAFE_INTEGER} value={seed} onChange={e => setSeed(Number(e.target.value))} /></label>
          <label className="space-y-1 text-sm">Faker locale<Input value={template.locale} onChange={e => setTemplate({ ...template, locale: e.target.value })} /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void run(async () => { await customRequest("/custom/validate", "POST", request); setMessage("Schema and generation constraints are valid."); })}>Validate Schema</Button>
          <Button onClick={() => void run(async () => { const result = await (await customRequest("/custom/generate", "POST", request)).json(); setDataset(result); setSnapshot(structuredClone(request)); setPage(0); })}><Sparkles />Generate Dataset</Button>
        </div>
      </section>
    </fieldset>
    {busy && <p role="status" className="text-sm text-slate-600">Working...</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <section className={`${card} min-w-0`}>
      <h3 className="text-lg font-semibold">Dataset preview</h3>
      {stale && <p role="status" className="my-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Preview is outdated. Regenerate to export the updated configuration.</p>}
      {!dataset ? <p className="mt-4 text-sm text-slate-500">Add your fields and generate a dataset to preview records.</p> : <>
        <p className="mt-2 text-sm text-slate-500">{dataset.total_records} synthetic records · Seed {dataset.seed}</p>
        <div className="mt-4 flex flex-wrap gap-2">{[ ["csv", "CSV"], ["json", "JSON"], ["xlsx", "Excel"] ].map(([format, label]) => <Button key={format} variant="outline" disabled={busy || stale} onClick={() => void run(async () => {
          await downloadResponse(await customRequest(`/custom/export?format=${format}`, "POST", snapshot), `synthetic-dataset-${dataset.total_records}-seed-${dataset.seed}.${format}`);
        })}>Download {label}</Button>)}</div>
        <div className="mt-4 max-w-full overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-50"><tr>{dataset.fields.map(name => <th className="px-4 py-3" key={name} scope="col">{snapshot?.template.fields.find(f => f.name === name)?.label || name}</th>)}</tr></thead>
            <tbody>{dataset.data.slice(page * 25, (page + 1) * 25).map((row, i) => <tr className="border-t border-slate-100" key={i}>{dataset.fields.map(name => <td className="px-4 py-3" key={name}>{row[name] === null ? <span className="text-slate-400">null</span> : String(row[name])}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>Page {page + 1} of {Math.ceil(dataset.total_records / 25)}</span><div className="flex gap-2"><Button variant="outline" disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" disabled={(page + 1) * 25 >= dataset.total_records || busy} onClick={() => setPage(page + 1)}>Next</Button></div></div>
      </>}
    </section>
  </div>;
}

