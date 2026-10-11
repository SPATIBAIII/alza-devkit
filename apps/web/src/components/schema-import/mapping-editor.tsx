import type { SchemaColumn } from "@/types/schema-import";
import { Input } from "@/components/ui/input";

const control = "w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-sm";
const numeric = ["integer", "quantity", "decimal", "price", "household_size", "grade_level"];
const sequences = ["sequence", "student_id", "employee_id", "transaction_id"];
const dates = ["date", "datetime", "birth_date", "transaction_date"];

export function MappingEditor({ column, types, foreign, onChange }: {
  column: SchemaColumn; types: string[]; foreign: boolean; onChange: (column: SchemaColumn) => void;
}) {
  const options = column.generator_options;
  function option(name: string, value: string | number | string[]) {
    onChange({ ...column, generator_options: { ...options, [name]: value } });
  }
  function setting(name: string, label: string, fallback: string | number, type = "number") {
    return <label className="space-y-1 text-sm" key={name}>{label}<Input aria-label={`${column.name} ${label}`} type={type} step={type === "number" ? "any" : undefined}
      value={String(options[name] ?? fallback)} onChange={e => option(name, type === "number" ? Number(e.target.value) : e.target.value)} /></label>;
  }
  return <article className="rounded-xl border border-slate-200 bg-white/60 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><p className="break-all font-medium">{column.name}</p><p className="text-xs text-slate-500">{column.database_type} {column.primary_key ? "· Primary key" : ""} {column.unique ? "· Unique" : ""} {column.nullable ? "· Nullable" : "· Required"}</p></div>
      <label className="w-full sm:w-52"><span className="sr-only">{column.name} generator</span><select className={control} value={column.synthetic_generator}
        onChange={e => onChange({ ...column, synthetic_generator: e.target.value, generator_options: e.target.value === "enum" ? { values: column.enum_values.length ? column.enum_values : ["Sample"] } : e.target.value === "datetime" ? { format: "%Y-%m-%dT%H:%M:%S" } : {} })}>
        {types.map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
      </select></label>
    </div>
    {foreign && <p className="mt-2 text-xs text-blue-700">Relationship enforced: generated parent keys supply this column. Its mapping is retained but not used while the relationship exists.</p>}
    <details className="mt-3"><summary className="cursor-pointer text-sm text-slate-600">Generator options for {column.name}</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {numeric.includes(column.synthetic_generator) && <>{setting("min", "Minimum", 0)}{setting("max", "Maximum", 100)}</>}
        {["decimal", "price"].includes(column.synthetic_generator) && setting("precision", "Decimal places", 2)}
        {column.synthetic_generator === "string" && <>{setting("min_length", "Minimum length", 5)}{setting("max_length", "Maximum length", 20)}</>}
        {sequences.includes(column.synthetic_generator) && <>{setting("start", "Starting number", 1)}{setting("step", "Increment", 1)}{setting("padding", "Zero padding", 0)}</>}
        {(sequences.includes(column.synthetic_generator) || column.synthetic_generator === "string") && <>{setting("prefix", "Prefix", "", "text")}{setting("suffix", "Suffix", "", "text")}</>}
        {dates.includes(column.synthetic_generator) && <>{setting("min_date", "Minimum date", "2000-01-01", "date")}{setting("max_date", "Maximum date", "2025-12-31", "date")}</>}
        {column.synthetic_generator === "enum" && <label className="text-sm">Values (one per line)<textarea aria-label={`${column.name} Enum values`} className={`${control} mt-1 h-28`} value={(options.values as string[] ?? []).join("\n")} onChange={e => option("values", e.target.value.split("\n"))} /></label>}
        <p className="text-xs text-slate-500 sm:col-span-2">SQL keys, types, length limits and supported CHECK constraints remain enforced. Incompatible mappings produce a validation error.</p>
      </div>
    </details>
  </article>;
}
