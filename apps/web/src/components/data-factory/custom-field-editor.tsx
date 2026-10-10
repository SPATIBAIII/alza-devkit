import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomField } from "@/types/custom-dataset";

const selectClass = "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm";
const numeric = ["integer", "decimal", "price", "quantity", "household_size", "grade_level"];
const dates = ["date", "datetime", "birth_date", "transaction_date"];
const sequences = ["sequence", "student_id", "employee_id", "transaction_id"];

export function CustomFieldEditor({ field, index, types, count, onChange, onMove, onDuplicate, onDelete }: {
  field: CustomField; index: number; types: string[]; count: number; onChange: (f: CustomField) => void;
  onMove: (direction: number) => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const o = field.options;
  function option(key: string, value: string | number | string[] | number[]) { onChange({ ...field, options: { ...o, [key]: value } }); }
  function setting(key: string, label: string, fallback: string | number, type = "text") {
    return <label className="space-y-1 text-sm" key={key}>{label}<Input aria-label={`${field.name} ${label}`} type={type} value={String(o[key] ?? fallback)} onChange={e => option(key, type === "number" ? Number(e.target.value) : e.target.value)} /></label>;
  }
  return <article className="rounded-2xl border border-slate-200 bg-white/70 p-4" aria-label={`Field ${index + 1}`}>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm">Field name<Input aria-label={`Field ${index + 1} name`} value={field.name} maxLength={64} onChange={e => onChange({ ...field, name: e.target.value })} /></label>
      <label className="space-y-1 text-sm">Data type<select aria-label={`Field ${index + 1} type`} className={selectClass} value={field.type} onChange={e => onChange({ ...field, type: e.target.value, options: {}, default: null, computed: e.target.value === "computed" ? { operation: "multiply", sources: ["", ""] } : null })}>
        {types.map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
      </select></label>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <label><input type="checkbox" checked={field.required} onChange={e => onChange({ ...field, required: e.target.checked, null_probability: 0 })} /> Required</label>
      <label><input type="checkbox" checked={field.unique} onChange={e => onChange({ ...field, unique: e.target.checked })} /> Unique</label>
      <div className="ml-auto flex gap-1">
        <Button variant="ghost" size="icon" aria-label={`Move ${field.name} up`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp /></Button>
        <Button variant="ghost" size="icon" aria-label={`Move ${field.name} down`} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown /></Button>
        <Button variant="ghost" size="icon" aria-label={`Duplicate ${field.name}`} disabled={count >= 50} onClick={onDuplicate}><Copy /></Button>
        <Button variant="ghost" size="icon" aria-label={`Delete ${field.name}`} disabled={count === 1} onClick={onDelete}><Trash2 /></Button>
      </div>
    </div>
    <details className="mt-3"><summary className="cursor-pointer text-sm text-slate-600">Advanced settings</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Display label<Input value={field.label} maxLength={100} onChange={e => onChange({ ...field, label: e.target.value })} /></label>
        {!field.required && <label className="space-y-1 text-sm">Null probability<Input type="number" min={0} max={1} step={0.05} value={field.null_probability} onChange={e => onChange({ ...field, null_probability: Number(e.target.value) })} /></label>}
        {field.type !== "computed" && <label className="space-y-1 text-sm">Default value (optional)
          {field.type === "boolean" ? <select aria-label={`${field.name} Default value`} className={selectClass} value={field.default == null ? "" : String(field.default)} onChange={e => onChange({ ...field, default: e.target.value === "" ? null : e.target.value === "true" })}><option value="">Generate a value</option><option value="true">True</option><option value="false">False</option></select>
            : <Input type={numeric.includes(field.type) ? "number" : "text"} step="any" value={String(field.default ?? "")} placeholder="Generate a value" onChange={e => onChange({ ...field, default: e.target.value === "" ? null : numeric.includes(field.type) ? Number(e.target.value) : e.target.value })} />}
          <span className="text-xs text-slate-500">When set, used for every non-null row.</span></label>}
        {numeric.includes(field.type) && <>{setting("min", "Minimum", ["household_size", "grade_level"].includes(field.type) ? 1 : 0, "number")}{setting("max", "Maximum", ["household_size", "grade_level"].includes(field.type) ? 12 : 100, "number")}<p className="text-xs text-slate-500">Uniform distribution</p></>}
        {(["decimal", "price"].includes(field.type) || field.computed?.operation === "multiply") && setting("precision", "Decimal precision", 2, "number")}
        {field.type === "string" && <>{setting("min_length", "Minimum length", 5, "number")}{setting("max_length", "Maximum length", 20, "number")}</>}
        {(field.type === "string" || sequences.includes(field.type)) && <>{setting("prefix", "Prefix", "")}{setting("suffix", "Suffix", "")}</>}
        {sequences.includes(field.type) && <>{setting("start", "Starting number", 1, "number")}{setting("step", "Increment", 1, "number")}{setting("padding", "Zero padding", 5, "number")}</>}
        {dates.includes(field.type) && <>{setting("min_date", "Minimum date", "2000-01-01", "date")}{setting("max_date", "Maximum date", "2025-12-31", "date")}
          <label className="space-y-1 text-sm">Output format<select className={selectClass} value={String(o.format ?? "%Y-%m-%d")} onChange={e => option("format", e.target.value)}>{["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S"].map(f => <option key={f}>{f}</option>)}</select></label></>}
        {field.type === "enum" && <>
          <label className="space-y-1 text-sm">Values (one per line)<textarea className={`${selectClass} h-28 py-2`} value={(o.values as string[] ?? []).join("\n")} onChange={e => option("values", e.target.value.split("\n"))} /></label>
          <label className="space-y-1 text-sm">Weights (optional, one per line)<textarea className={`${selectClass} h-28 py-2`} value={(o.weights as number[] ?? []).join("\n")} onChange={e => onChange({ ...field, options: { ...o, weights: e.target.value.trim() ? e.target.value.split("\n").map(Number) : null } })} /></label>
        </>}
        {field.computed && <>
          <label className="space-y-1 text-sm">Computed operation<select className={selectClass} value={field.computed.operation} onChange={e => onChange({ ...field, computed: { operation: e.target.value as "multiply" | "age" | "full_name", sources: e.target.value === "age" ? [""] : ["", ""], ...(e.target.value === "age" ? { reference_date: "2026-01-01" } : {}) } })}><option value="multiply">Multiply two fields</option><option value="age">Age from birth date</option><option value="full_name">Join first and last name</option></select></label>
          {field.computed.sources.map((source, i) => <label className="space-y-1 text-sm" key={i}>Source field {i + 1}<Input value={source} onChange={e => onChange({ ...field, computed: { ...field.computed!, sources: field.computed!.sources.map((s, j) => i === j ? e.target.value : s) } })} /></label>)}
          {field.computed.operation === "age" && <label className="space-y-1 text-sm">Reference date<Input type="date" value={field.computed.reference_date ?? ""} onChange={e => onChange({ ...field, computed: { ...field.computed!, reference_date: e.target.value } })} /></label>}
        </>}
      </div>
    </details>
  </article>;
}
